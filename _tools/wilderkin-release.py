"""Compare the playable Pages release with its checked-out sources."""
import argparse
import concurrent.futures
import hashlib
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

GAME = Path(__file__).resolve().parents[1] / "games/wilderkin"


class EntryAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = set()

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        ref = attr.get("src") if tag == "script" else attr.get("href") if tag == "link" else None
        resources = (ref, attr.get("data-doubles")) if tag == "script" else (ref,)
        for url in resources:
            if url and not urlsplit(url).netloc and urlsplit(url).path:
                self.assets.add(url)


def release_assets():
    entry = EntryAssets()
    entry.feed((GAME / "index.html").read_text())
    assets = {str(p.relative_to(GAME)) for folder in ("art", "ui", "network")
              for p in (GAME / folder).rglob("*") if p.is_file()}
    assets.update(p.name for p in GAME.glob("*.mjs"))
    # Include separately loaded feature bundles as well as the initial HTML references.
    assets.update(p.name for p in GAME.glob("play*.js"))
    assets.update(entry.assets)
    return sorted(assets)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    dest = parser.add_mutually_exclusive_group(required=True)
    dest.add_argument("--url", help="Public game directory including the trailing slash")
    dest.add_argument("--site-root", type=Path, help="Built Jekyll site directory")
    args = parser.parse_args()
    base = args.url.rstrip("/") + "/" if args.url else None

    def compare(ref):
        path = urlsplit(ref).path or "index.html"
        expected = (GAME / path).read_bytes()
        if base:
            request = Request(urljoin(base, ref), headers={"User-Agent": "Wilderkin-release-check/1"})
            with urlopen(request, timeout=30) as response:
                actual = response.read()
        else:
            actual = (args.site_root / "games" / "wilderkin" / path).read_bytes()
        if expected != actual:
            raise ValueError(f"{ref or 'index'} differs (expected {hashlib.sha256(expected).hexdigest()[:12]}, "
                             f"received {hashlib.sha256(actual).hexdigest()[:12]})")

    compare("")  # Fail fast if Pages still serves the previous release.
    assets = release_assets()
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(compare, assets))
    print(f"Matched HTML and {len(assets)} asset URLs at {base or args.site_root}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(str(error))
