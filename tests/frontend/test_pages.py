import re
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PAGES_DIR = ROOT_DIR / "frontend" / "pages"
STATIC_DIR = ROOT_DIR / "frontend" / "static"


def _asset_exists(asset_path: str) -> bool:
    return (STATIC_DIR / asset_path.removeprefix("/static/")).exists()


def test_html_pages_have_titles():
    page_files = list(PAGES_DIR.glob("*.html"))
    assert page_files, "Expected frontend pages to exist"

    for page_file in page_files:
        contents = page_file.read_text(encoding="utf-8")
        assert "<title>" in contents, f"{page_file.name} is missing a title"
        assert "<body" in contents, f"{page_file.name} is missing a body tag"


def test_static_asset_links_point_to_existing_files():
    page_files = list(PAGES_DIR.glob("*.html"))
    asset_pattern = re.compile(r'''(?:href|src)=["'](/static/[^"']+)["']''')

    for page_file in page_files:
        contents = page_file.read_text(encoding="utf-8")
        assets = asset_pattern.findall(contents)
        for asset in assets:
            assert _asset_exists(asset), f"{page_file.name} references missing asset {asset}"
