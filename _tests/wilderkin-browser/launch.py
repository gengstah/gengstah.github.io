"""Exercise initial and optional download failures. Add --measure for the cold mobile Chromium profile."""
import argparse
import functools
import gzip
import json
import statistics
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

from smoke import launch


class GameRequest(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    disable_nagle_algorithm = True

    def do_GET(self):
        path = Path(self.translate_path(self.path))
        if path.name in self.server.unavailable:
            self.send_error(503)
            return
        if path.is_dir():
            path = path / "index.html"
        if not path.is_file() or path.suffix not in {".html", ".css", ".js", ".mjs"}:
            return super().do_GET()
        data = gzip.compress(path.read_bytes(), compresslevel=6, mtime=0)
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass


def recovery(browser, server, url):
    driver = launch(browser)
    wait = WebDriverWait(driver, 15)
    def element(selector):
        return wait.until(lambda d: d.find_element(By.CSS_SELECTOR, selector))
    def wait_text(selector, text):
        # Navigation rebuilds the accessible controls. Read the current node in one browser call.
        wait.until(lambda d: d.execute_script(
            "return document.querySelector(arguments[0])?.textContent.includes(arguments[1]) === true",
            selector, text))
    try:
        server.unavailable = {"play.js"}
        driver.get(url)
        retry = element("#launch-retry:not([hidden])")
        assert element("main").get_dom_attribute("inert") is not None
        server.unavailable.clear()
        retry.send_keys(Keys.ENTER)
        element("#launch[hidden]")
        element("[data-action=interact]")

        server.unavailable = {"play-doubles.js"}
        driver.get(url + "#twinbell")
        wait_text("main [role=status]", "could not load")
        element("[data-action=interact]")
        driver.find_element(By.TAG_NAME, "body").send_keys("q")
        wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, "[data-action=interact]"))
        server.unavailable.clear()
        driver.execute_script("location.hash='switchyard'")
        wait_text(".wilder-assist p", "Switchyard")
        print(f"{browser} passed keyboard startup recovery, optional feature failure and retry")
    finally:
        server.unavailable.clear()
        driver.quit()


def measure(url):
    rows = []
    for _ in range(3):
        driver = launch("chrome")
        try:
            driver.execute_cdp_cmd("Network.enable", {})
            driver.execute_cdp_cmd("Network.setCacheDisabled", {"cacheDisabled": True})
            driver.execute_cdp_cmd("Network.emulateNetworkConditions", {
                "offline": False, "latency": 150, "downloadThroughput": 1_600_000 / 8,
                "uploadThroughput": 750_000 / 8,
            })
            driver.execute_cdp_cmd("Emulation.setCPUThrottlingRate", {"rate": 4})
            driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
                new MutationObserver((_, observer) => {
                  if (document.querySelector('[data-action=interact]')) {
                    window.trailReady = performance.now();
                    observer.disconnect();
                  }
                }).observe(document, {childList:true, subtree:true});
            """})
            driver.get(url)
            rows.append(WebDriverWait(driver, 20).until(lambda d: d.execute_script("""
                const scripts = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script');
                const paint = performance.getEntriesByName('first-contentful-paint')[0];
                return paint && window.trailReady ? {
                  readyMs: Math.round(window.trailReady), firstPaintMs: Math.round(paint.startTime),
                  scripts: scripts.length, scriptBytes: scripts.reduce((sum,r) => sum + r.encodedBodySize, 0)
                } : null;
            """)))
        finally:
            driver.quit()
    median = {key: statistics.median(row[key] for row in rows) for key in rows[0]}
    print(json.dumps({"runs": rows, "median": median}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--browser", choices=["chrome", "firefox"], default="chrome")
    parser.add_argument("--measure", action="store_true")
    args = parser.parse_args()
    handler = functools.partial(GameRequest, directory=args.site_root)
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        server.unavailable = set()
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/games/wilderkin/"
            recovery(args.browser, server, url)
            if args.measure:
                measure(url)
        finally:
            server.shutdown()
            thread.join()
