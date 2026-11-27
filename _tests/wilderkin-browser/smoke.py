"""Play the release through real input on a fresh, disposable browser profile."""
import argparse
import contextlib
import functools
import json
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.support.ui import WebDriverWait


class StaticRequest(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@contextlib.contextmanager
def serve(directory):
    handler = functools.partial(StaticRequest, directory=directory)
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/games/wilderkin/"
        finally:
            server.shutdown()
            thread.join()


def launch(browser):
    if browser == "chrome":
        options = webdriver.ChromeOptions()
        binary = shutil.which("google-chrome") or shutil.which("chromium")
        if binary:
            options.binary_location = binary
        options.add_argument("--headless")
        options.add_argument("--disable-dev-shm-usage")
        options.add_experimental_option("mobileEmulation", {"deviceMetrics": {
            "width": 320, "height": 568, "pixelRatio": 2, "touch": True, "mobile": True,
        }})
        options.enable_bidi = True
        return webdriver.Chrome(options=options, service=ChromeService(shutil.which("chromedriver")))
    options = webdriver.FirefoxOptions()
    options.add_argument("--headless")
    options.set_preference("ui.prefersReducedMotion", 1)
    options.enable_bidi = True
    driver = webdriver.Firefox(options=options, service=FirefoxService(shutil.which("geckodriver")))
    driver.set_window_size(1280, 850)
    return driver


class Journey:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 20, poll_frequency=0.1)

    def read(self, js, *args):
        return self.driver.execute_script("return " + js, *args)

    def until(self, js, *args):
        return self.wait.until(lambda _: self.read(js, *args), js)

    def control(self, action, value=None):
        query = f'button[data-action="{action}"]'
        if value is not None:
            query += f'[data-value="{value}"]'
        return self.wait.until(lambda d: next(iter(d.find_elements(By.CSS_SELECTOR, query)), None), query)

    def choose(self, action, value=None):
        button = self.control(action, value)
        assert button.is_enabled(), button.get_attribute("textContent")
        # The accessible control mirrors a canvas target and is clipped visually.
        self.driver.execute_script("arguments[0].focus()", button)
        ActionChains(self.driver).send_keys(Keys.ENTER).perform()

    def key(self, key):
        self.driver.switch_to.active_element.send_keys(key)

    def touch_label(self, label):
        # Locate the button lettering as actually painted, then send native touch
        # at its viewport position. This also catches controls drawn below the fold.
        self.driver.execute_script("""
          const wanted = arguments[0];
          window.smokeTarget = null;
          const paint = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...args) {
            if (this.canvas.id === 'game-canvas' && text === wanted) {
              const p = this.getTransform().transformPoint({x: x + 4, y: y + 4});
              const b = this.canvas.getBoundingClientRect();
              window.smokeTarget = [b.x + p.x * b.width / this.canvas.width,
                                    b.y + p.y * b.height / this.canvas.height];
              CanvasRenderingContext2D.prototype.fillText = paint;
            }
            return paint.call(this, text, x, y, ...args);
          };""", label)
        x, y = self.until("window.smokeTarget")
        assert self.read("document.elementFromPoint(...arguments[0])?.id", [x, y]) == "game-canvas"
        self.driver.execute_cdp_cmd("Input.dispatchTouchEvent", {
            "type": "touchStart", "touchPoints": [{"x": x, "y": y}],
        })
        self.driver.execute_cdp_cmd("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

    def first_battle(self, mobile):
        self.control("nav", "first-battle")
        if mobile:
            self.touch_label("Battle Opalclasp")
        else:
            for _ in range(15):
                self.key(Keys.TAB)
                if self.read("document.activeElement?.dataset.value === 'first-battle'"):
                    break
            else:
                raise AssertionError("The opening battle was not reachable by Tab")
            self.key(Keys.ENTER)
        self.choose("first-battle-lead", "dewfin")
        self.control("skill", "bubble-jet")
        self.driver.execute_script("""
          window.smokeHits = [];
          const region = document.querySelector('[aria-live]');
          new MutationObserver(() => smokeHits.push(region.textContent))
            .observe(region, {childList:true, subtree:true, characterData:true});""")
        if mobile:
            self.touch_label("Bubble Jet")
        else:
            self.choose("skill", "bubble-jet")
        self.until("window.smokeHits.some(s => s.startsWith('Dewfin lost '))")
        losses = [line.split(" lost ")[0] for line in self.read("window.smokeHits") if " lost " in line]
        assert losses[:2] == ["Opalclasp", "Dewfin"], losses
        self.until("document.querySelector('.wilder-assist p').textContent.includes('TURN 2')")
        snapshot = self.read("WilderGame.state.battle")
        self.driver.refresh()
        self.control("skill", "bubble-jet")
        assert self.read("WilderGame.state.battle.turn === arguments[0].turn && "
                         "WilderGame.state.battle.enemy.hp === arguments[0].enemy.hp", snapshot)
        for turn in range(snapshot["turn"], snapshot["turn"] + 8):
            self.choose("skill", "bubble-jet")
            self.until("document.querySelector('.wilder-assist p').textContent.includes('TURN ' + arguments[0])"
                       " || document.querySelector('.wilder-assist p').textContent.includes('Battle won')", turn + 1)
            if self.read("WilderGame.state.battle === null"):
                break
        else:
            raise AssertionError("Dewfin never finished the opening encounter")
        self.choose("root")
        print("Won the first battle, heard both hit announcements in order and resumed the saved turn.", flush=True)

    def quest_crossing(self):
        self.choose("walk-marker", "road-3")
        self.until("WilderGame.state.region === 3")
        self.choose("walk-marker", "road-4")
        self.control("view", "request|four-corners")
        assert self.read("WilderGame.state.region") == 3
        assert not self.control("travel", 4).is_enabled()
        self.choose("view", "request|four-corners")
        self.choose("request-step", "four-corners")
        for town in [1, 2]:
            self.choose("request-travel", f"{town}|four-corners")
            self.until("WilderGame.state.region === arguments[0]", town)
        assert not self.read("WilderGame.access(4).open")
        self.choose("request-step", "four-corners")
        self.choose("view", "region|4")
        self.choose("travel", 4)
        self.until("WilderGame.state.region === 4")
        self.driver.refresh()
        self.control("walk-marker", "road-3")
        assert self.read("WilderGame.state.region === 4 && WilderGame.state.quests['four-corners'] === 'claimed'")
        self.choose("walk-marker", "road-3")
        self.until("WilderGame.state.region === 3")
        self.key("e")
        self.until("WilderGame.state.region === 4")
        print("Turned in Saff's quest, crossed the unlocked border both ways and retained progress on reload.", flush=True)

    def navigation(self):
        self.key("p")
        self.control("open-trios")
        self.driver.back()
        self.control("walk-marker")
        self.driver.forward()
        self.control("open-trios")
        self.driver.back()
        self.control("walk-marker")
        ActionChains(self.driver).key_down(Keys.SHIFT).send_keys(Keys.ESCAPE).key_up(Keys.SHIFT).perform()
        self.until("document.activeElement?.textContent === 'Leave Wilderkin'")

    def local_multiplayer(self, url):
        # Exercise the shipped BroadcastChannel path without sending messages to
        # public relays. Only the missing Internet transport is simulated.
        first = self.driver.current_window_handle
        self.driver.get(url.split("#", 1)[0] + "#online")
        self.control("realm-private")
        self.driver.execute_script("window.WebSocket = undefined")
        self.choose("realm-private")
        status = "document.querySelector('.wilder-assist p').textContent.includes('LOCAL TABS')"
        self.until(status)
        self.control("realm-practice")
        self.choose("realm-map")
        room = self.driver.current_url
        assert "#online/friends-" in room and room.endswith("/map"), room
        self.control("realm-copy")
        self.driver.switch_to.new_window("tab")
        second = self.driver.current_window_handle
        self.driver.get(room)
        self.control("realm-join")
        self.driver.execute_script("window.WebSocket = undefined")
        self.choose("realm-join")
        self.until(status)
        self.control("realm-person")
        self.choose("realm-queue")
        self.choose("realm-queue")
        assert "Open to challenges" in self.control("realm-toggle").get_attribute("textContent")
        self.choose("realm-toggle")
        self.driver.switch_to.window(first)
        self.choose("nav", "online")
        self.control("realm-person")
        self.choose("realm-team")
        self.choose("realm-slot", 0)
        self.choose("realm-pick", "0|cindlet")
        self.control("realm-confirm-pick", "0|cindlet")
        self.choose("realm-team")
        self.choose("realm-home")
        self.choose("realm-person")
        self.choose("realm-challenge")
        self.driver.switch_to.window(second)
        self.choose("realm-accept")
        self.control("realm-duel-confirm")
        # Both seats see the same round. Only the player with initiative has
        # available moves. Play one and receive its reply before conceding.
        if not self.read("document.querySelector('button[data-action=realm-duel-move]:enabled')"):
            self.driver.switch_to.window(first)
        actor = self.driver.current_window_handle
        self.choose("realm-duel-move")
        self.driver.switch_to.window(first if actor == second else second)
        self.choose("realm-duel-move")
        self.choose("realm-duel-confirm")
        self.choose("realm-duel-concede")
        self.driver.switch_to.window(first)
        self.choose("realm-duel-dismiss")
        self.choose("realm-leave")
        self.control("nav", "wild-calls")
        assert self.read("WilderGame.state.region === 4 && WilderGame.access(4).open")
        print("Opened a friend’s map link, restored quiet mode, previewed a trio and played a two-seat duel.", flush=True)


def run(args, url):
    errors = []
    site = urlsplit(url).netloc
    with launch(args.browser) as driver:
        driver.script.add_error_handler(lambda entry: errors.append(str(entry)))

        def check_response(event):
            reply = event.response
            if urlsplit(reply["url"]).netloc == site and reply["status"] >= 400:
                errors.append(f"{reply['status']} {reply['url']}")

        def check_fetch(event):
            url = event.request["url"]
            # Browsers cancel in-flight image loads when the journey reloads.
            if urlsplit(url).netloc == site and "abort" not in str(event.error_text).lower():
                errors.append(f"{event.error_text} {url}")

        driver.network.add_event_handler("response_completed", check_response)
        driver.network.add_event_handler("fetch_error", check_fetch)
        try:
            driver.get(url)
            journey = Journey(driver)
            journey.first_battle(args.browser == "chrome")
            journey.quest_crossing()
            journey.navigation()
            journey.local_multiplayer(url)
            assert not errors, errors
        except Exception:
            if args.screenshot:
                driver.save_screenshot(str(args.screenshot))
            print("URL", driver.current_url, "browser errors", json.dumps(errors), flush=True)
            raise
        print(f"{args.browser} {driver.capabilities['browserVersion']} passed.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", required=True, choices=["chrome", "firefox"])
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--url", help="Published Wilderkin URL, including its trailing slash")
    source.add_argument("--site-root", type=Path, default=Path(__file__).resolve().parents[2],
                        help="Site root containing games/wilderkin (defaults to this checkout)")
    parser.add_argument("--screenshot", type=Path, help="PNG to save on a journey failure")
    args = parser.parse_args()
    target = contextlib.nullcontext(args.url) if args.url else serve(args.site_root)
    with target as url:
        run(args, url)


if __name__ == "__main__":
    main()
