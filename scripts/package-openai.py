"""Build the OpenAI review ZIP from the marketplace dossier."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DOSSIER = ROOT / "docs" / "marketplace"
SCHEMA_BASE = "https://agent-plugins.org/schemas/1.0.0"


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--demo-url", help="Reviewer-accessible HTTPS recording")
    args = parser.parse_args()

    data = json.loads((DOSSIER / "submission-data.json").read_text())
    cases = json.loads((DOSSIER / "test-cases.json").read_text())
    openai = data["openai"]
    service = data["service"]
    if service["authentication"] != "none":
        parser.error("this package expects an anonymous MCP endpoint")
    listing_en = openai["baseListingEn"]
    icon_path = "assets/poligraph-icon-512.png"
    review = {
        "test_cases": {
            "positive": [
                {
                    "description": case["name"],
                    "prompt": case["prompt"],
                    "tools_triggered": ", ".join(case["expectedTools"]),
                    "expected_behavior": " ".join(case["expectedBehavior"]),
                }
                for case in cases["positive"]
            ],
            "negative": [
                {
                    "description": f'{case["name"]}. {" ".join(case["expectedBehavior"])}',
                    "prompt": case["prompt"],
                }
                for case in cases["negative"]
            ],
        },
        "commerce": False,
    }
    demo = args.demo_url or openai["demoRecording"]["url"]
    if demo:
        parsed = urlsplit(demo)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None:
            parser.error("the demo recording must use HTTPS, with no embedded credentials")
        review["demo_recording_url"] = demo

    plugin = {
        "$schema": f"{SCHEMA_BASE}/plugin.schema.json",
        "name": openai["packageName"],
        "version": openai["version"],
        "description": listing_en["longDescription"],
        "author": {
            "name": service["publisher"],
            "email": service["publisherEmail"],
            "url": "https://poligraph.fr/",
        },
        "homepage": openai["websiteUrl"],
        "repository": "https://github.com/ironlam/poligraph-mcp",
        "license": "MIT",
        "extensions": {
            "com.openai": {
                "interface": {
                    "displayName": openai["displayName"],
                    "shortDescription": listing_en["shortDescription"],
                    "longDescription": listing_en["longDescription"],
                    "developerName": openai["developerName"],
                    "category": openai["category"]["packageValue"],
                    "capabilities": listing_en["capabilities"],
                    "websiteURL": openai["websiteUrl"],
                    "supportURL": openai["supportUrl"],
                    "privacyPolicyURL": openai["privacyUrl"],
                    "termsOfServiceURL": openai["termsUrl"],
                    "defaultPrompt": openai["starterPrompts"],
                    "logo": "./" + icon_path,
                    "composerIcon": "./" + icon_path,
                },
                "review": review,
                "publication": {
                    "release_notes": openai["releaseNotesFr"],
                    "translations": {
                        "fr-FR": {
                            "subtitle": openai["shortDescription"],
                            "description": openai["longDescription"],
                        },
                    },
                },
            },
        },
    }
    mcp = {
        "$schema": f"{SCHEMA_BASE}/mcp.schema.json",
        "mcpServers": {
            "poligraph": {
                "type": service["transport"],
                "url": service["mcpUrl"],
            },
        },
    }
    with ZipFile(args.output, "w") as archive:
        for name, content in (
            ("plugin.json", json_bytes(plugin)),
            ("mcp.json", json_bytes(mcp)),
            (icon_path, (DOSSIER / icon_path).read_bytes()),
        ):
            archive.writestr(ZipInfo(name), content, compress_type=ZIP_DEFLATED)


if __name__ == "__main__":
    main()
