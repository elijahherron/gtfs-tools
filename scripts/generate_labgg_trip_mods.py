#!/usr/bin/env python3
"""Regenerates trip-modifications/LABGG_trip_modifications.pb from
LABGG_trip_modifications.source.json, rolling the service_dates window
forward from today. Run by .github/workflows/refresh-labgg-trip-mods.yml on
a schedule so the feed never looks stale to QA without anyone re-uploading
it by hand.

The real LABGG feed encodes one FeedEntity per (direction, date) pair
rather than one entity with a list of dates, so that's what we reproduce
here: a static stop/shape entity block, plus one dated trip_modifications
entity per template per day in the rolling window.
"""
import datetime
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "trip-modifications" / "LABGG_trip_modifications.source.json"
PROTO_DIR = ROOT / "scripts" / "proto"
PROTO_FILE = PROTO_DIR / "gtfs-realtime.proto"
OUTPUT = ROOT / "trip-modifications" / "LABGG_trip_modifications.pb"


def to_textproto(obj, indent=1):
    pad = "  " * indent
    lines = []
    for key, value in obj.items():
        for item in value if isinstance(value, list) else [value]:
            lines.extend(emit_field(key, item, indent, pad))
    return lines


def emit_field(key, value, indent, pad):
    if isinstance(value, dict):
        return [f"{pad}{key} {{"] + to_textproto(value, indent + 1) + [f"{pad}}}"]
    if isinstance(value, bool):
        return [f"{pad}{key}: {'true' if value else 'false'}"]
    if isinstance(value, str):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return [f'{pad}{key}: "{escaped}"']
    if isinstance(value, (int, float)):
        return [f"{pad}{key}: {value}"]
    raise TypeError(f"Unsupported value for {key!r}: {value!r}")


def rolling_dates(days):
    start = datetime.date.today()
    return [(start + datetime.timedelta(days=i)).strftime("%Y%m%d") for i in range(days)]


def build_entities(source, dates):
    entities = list(source["static_entities"])
    for date in dates:
        for template in source["daily_modification_templates"]:
            entities.append({
                "id": f"{template['numeric_id']}_{date}",
                "trip_modifications": {
                    "selected_trips": [{
                        "trip_ids": template["trip_ids"],
                        "shape_id": template["shape_id"],
                    }],
                    "service_dates": [date],
                    "modifications": [template["modification"]],
                },
            })
    return entities


def main():
    source = json.loads(SOURCE.read_text())
    dates = rolling_dates(source.get("rolling_window_days", 182))
    entities = build_entities(source, dates)

    now = int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    lines = [
        "header {",
        f'  gtfs_realtime_version: "{source.get("gtfs_realtime_version", "")}"',
        "  incrementality: FULL_DATASET",
        f"  timestamp: {now}",
        "}",
    ]
    for entity in entities:
        lines.append("entity {")
        lines.extend(to_textproto(entity))
        lines.append("}")
    textproto = "\n".join(lines) + "\n"

    result = subprocess.run(
        [
            "protoc",
            "--encode=transit_realtime.FeedMessage",
            f"--proto_path={PROTO_DIR}",
            str(PROTO_FILE),
        ],
        input=textproto.encode(),
        capture_output=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr.decode())
        sys.exit(1)

    OUTPUT.write_bytes(result.stdout)
    print(
        f"Wrote {OUTPUT} ({len(result.stdout)} bytes), timestamp={now}, "
        f"{len(entities)} entities, service_dates {dates[0]}..{dates[-1]} ({len(dates)} days)"
    )


if __name__ == "__main__":
    main()
