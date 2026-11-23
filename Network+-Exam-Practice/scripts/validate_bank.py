#!/usr/bin/env python3
"""Validate the Network+ question bank (data/domain-N.json).

Standard library only. Run with:  python -I scripts/validate_bank.py [data_dir] [--strict]

Exit code 1 on any error (or on any warning with --strict). The data is only ever parsed as
JSON and inspected; nothing in it is executed.
"""

import ipaddress
import json
import os
import re
import sys

EXAM = "N10-009"
MAX_FILE_BYTES = 2 * 1024 * 1024
TYPES = ("single", "multiple", "order", "match", "subnet")
PBQ_TYPES = ("order", "match", "subnet")
ITEM_KEYS = {"id", "domain", "objective", "type", "difficulty", "stem", "exhibit", "options",
             "selectCount", "data", "answer", "explanation", "drill"}
SUBNET_COLS = ("network", "prefix", "mask", "first", "last", "broadcast", "hosts")
OBJECTIVE_IDS = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "2.1", "2.2", "2.3", "2.4",
                 "3.1", "3.2", "3.3", "3.4", "3.5", "4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4", "5.5"]
DOMAIN_WEIGHTS = {1: 23, 2: 20, 3: 19, 4: 14, 5: 24}

ITEM_ID_RE = re.compile(r"^N9-([1-5]\.[1-9])-[0-9]{4}$")
PART_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$")
OPTION_ID_RE = re.compile(r"^[a-f]$")
RESERVED_IDS = {"constructor", "prototype", "toString", "valueOf", "hasOwnProperty",
                "isPrototypeOf", "propertyIsEnumerable", "toLocaleString"}
# control characters, soft hyphen, zero-width and bidirectional controls
BAD_CHARS_RE = re.compile("[\u0000-\u001f\u007f-\u009f­؜​-‏‪-‮⁠-⁩﻿]")
# Real URLs / schemes only. The protocol names HTTP, HTTPS, FTP... are valid exam vocabulary.
URL_RE = re.compile(r"(?i)\b(?:https?|ftp|javascript|data|vbscript|file):/|://|\b(?:javascript|vbscript):")
ALL_NONE_RE = re.compile(r"(?i)\b(?:all|none) of the above\b")
LOWER_NEG_RE = re.compile(r" (?:not|except) ")
CHOOSE = {2: "(Choose two.)", 3: "(Choose three.)"}
REUSE_RE = re.compile(r"(?i)options may be used more than once")


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, where, msg):
        self.errors.append("ERROR   %s: %s" % (where, msg))

    def warn(self, where, msg):
        self.warnings.append("WARNING %s: %s" % (where, msg))


class Bad(Exception):
    """Raised to stop checking one item after a structural error."""


def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def check_text(rep, where, value, lo, hi, what, allow_angle=False):
    """Return True when the text is usable; report problems."""
    if not isinstance(value, str):
        rep.error(where, "%s must be a string" % what)
        return False
    ok = True
    if not lo <= len(value) <= hi:
        rep.error(where, "%s length %d is outside %d-%d" % (what, len(value), lo, hi))
        ok = False
    if BAD_CHARS_RE.search(value):
        rep.error(where, "%s contains a control, zero-width or bidirectional character" % what)
        ok = False
    if not allow_angle and "<" in value:
        rep.error(where, "%s contains '<' (no HTML or tags in the bank)" % what)
        ok = False
    if allow_angle and re.search(r"(?i)<\s*/?\s*(?:script|img|svg|iframe|object|embed|style|link|a)\b", value):
        rep.error(where, "%s contains something that looks like an HTML tag" % what)
        ok = False
    if URL_RE.search(value):
        rep.error(where, "%s contains a URL or a URL scheme" % what)
        ok = False
    return ok


def only_keys(rep, where, obj, allowed, what):
    if not isinstance(obj, dict):
        rep.error(where, "%s must be an object" % what)
        raise Bad()
    extra = sorted(set(obj) - set(allowed))
    if extra:
        rep.error(where, "%s has unknown key(s): %s" % (what, ", ".join(extra)))
        raise Bad()


def part_list(rep, where, value, lo, hi, text_key, what):
    if not isinstance(value, list) or not lo <= len(value) <= hi:
        rep.error(where, "%s must be a list of %d-%d entries" % (what, lo, hi))
        raise Bad()
    out = []
    for part in value:
        only_keys(rep, where, part, ("id", text_key), what + " entry")
        pid = part.get("id")
        if not isinstance(pid, str) or not PART_ID_RE.match(pid) or pid in RESERVED_IDS:
            rep.error(where, "%s has an invalid id %r" % (what, pid))
            raise Bad()
        if pid in out:
            rep.error(where, "%s has a duplicate id %r" % (what, pid))
            raise Bad()
        check_text(rep, where, part.get(text_key), 1, 300, "%s %s" % (what, text_key))
        out.append(pid)
    texts = [p.get(text_key).strip().lower() for p in value if isinstance(p.get(text_key), str)]
    if len(set(texts)) != len(texts):
        rep.error(where, "%s has duplicate texts" % what)
    return out


def check_choice(rep, where, item):
    multi = item["type"] == "multiple"
    if "data" in item:
        rep.error(where, "'data' is not allowed on a %s item" % item["type"])
    options = item.get("options")
    lo = 5 if multi else 4
    if not isinstance(options, list) or not lo <= len(options) <= 6:
        rep.error(where, "%s needs %d-6 options" % (item["type"], lo))
        raise Bad()
    opt_ids, texts = [], []
    for opt in options:
        only_keys(rep, where, opt, ("id", "text", "why"), "option")
        oid = opt.get("id")
        if not isinstance(oid, str) or not OPTION_ID_RE.match(oid):
            rep.error(where, "option id %r must be one letter a-f" % (oid,))
            raise Bad()
        if oid in opt_ids:
            rep.error(where, "duplicate option id %r" % oid)
            raise Bad()
        opt_ids.append(oid)
        if check_text(rep, where, opt.get("text"), 1, 300, "option %s text" % oid):
            texts.append(opt["text"].strip().lower())
            if ALL_NONE_RE.search(opt["text"]):
                rep.error(where, "option %s uses 'all/none of the above'" % oid)
        check_text(rep, where, opt.get("why"), 10, 400, "option %s why" % oid)
    if len(set(texts)) != len(texts):
        rep.error(where, "option texts are not unique")
    answer = item.get("answer")
    only_keys(rep, where, answer, ("correct",), "answer")
    correct = answer.get("correct")
    if not isinstance(correct, list) or not correct or any(not isinstance(c, str) for c in correct):
        rep.error(where, "answer.correct must be a non-empty list of option ids")
        raise Bad()
    if len(set(correct)) != len(correct) or any(c not in opt_ids for c in correct):
        rep.error(where, "answer.correct has duplicate or unknown option ids")
    if multi:
        count = item.get("selectCount")
        if not is_int(count) or count not in (2, 3):
            rep.error(where, "selectCount must be 2 or 3 on a multiple item")
        elif len(correct) != count:
            rep.error(where, "answer.correct has %d ids but selectCount is %d" % (len(correct), count))
        elif isinstance(item.get("stem"), str) and not item["stem"].rstrip().endswith(CHOOSE[count]):
            rep.error(where, "the stem must end with %s" % CHOOSE[count])
    else:
        if len(correct) != 1:
            rep.error(where, "a single item needs exactly one correct option")
        if "selectCount" in item and item["selectCount"] != 1:
            rep.error(where, "selectCount must be absent or 1 on a single item")


def check_order(rep, where, item):
    data, answer = item.get("data"), item.get("answer")
    only_keys(rep, where, data, ("prompt", "items"), "data")
    only_keys(rep, where, answer, ("order",), "answer")
    check_text(rep, where, data.get("prompt"), 1, 400, "data.prompt")
    step_ids = part_list(rep, where, data.get("items"), 3, 8, "text", "data.items")
    order = answer.get("order")
    if not isinstance(order, list) or sorted(map(str, order)) != sorted(step_ids) or any(not isinstance(o, str) for o in order):
        rep.error(where, "answer.order must list every item id exactly once")
    elif order == step_ids:
        rep.warn(where, "data.items are already in the answer order (fine, the app shuffles them)")


def check_match(rep, where, item):
    data, answer = item.get("data"), item.get("answer")
    only_keys(rep, where, data, ("prompt", "left", "right"), "data")
    only_keys(rep, where, answer, ("pairs",), "answer")
    check_text(rep, where, data.get("prompt"), 1, 400, "data.prompt")
    left = part_list(rep, where, data.get("left"), 3, 8, "text", "data.left")
    right = part_list(rep, where, data.get("right"), 2, 11, "text", "data.right")
    reuse = isinstance(item.get("stem"), str) and bool(REUSE_RE.search(item["stem"]))
    if len(right) > len(left) + 3:
        rep.error(where, "data.right has more than 3 extra distractors")
    if not reuse and len(right) < len(left):
        rep.error(where, "data.right is shorter than data.left (allowed only when the stem says 'Options may be used more than once.')")
    pairs = answer.get("pairs")
    if not isinstance(pairs, dict) or sorted(pairs) != sorted(left):
        rep.error(where, "answer.pairs must have exactly one entry per left id")
        return
    values = list(pairs.values())
    if any(not isinstance(v, str) or v not in right for v in values):
        rep.error(where, "answer.pairs points to an unknown right id")
        return
    if len(set(values)) != len(values) and not reuse:
        rep.error(where, "a right item answers several left items but the stem does not say 'Options may be used more than once.'")


def parse_prefix(text):
    s = text.strip().lstrip("/")
    return int(s) if re.fullmatch(r"[0-9]{1,2}", s) and int(s) <= 32 else None


def parse_ip(text):
    try:
        return ipaddress.IPv4Address(text.strip())
    except (ipaddress.AddressValueError, ValueError):
        return None


def check_subnet_row(rep, where, rid, cells):
    """Recompute the row with the ipaddress module and compare. Returns the network or None."""
    tag = "answer.rows.%s" % rid
    prefix = None
    if "prefix" in cells:
        prefix = parse_prefix(cells["prefix"])
        if prefix is None:
            rep.error(where, "%s.prefix %r is not a valid prefix" % (tag, cells["prefix"]))
            return None
    if "mask" in cells:
        mask_ip = parse_ip(cells["mask"])
        try:
            mask_prefix = ipaddress.IPv4Network("0.0.0.0/%s" % cells["mask"].strip()).prefixlen if mask_ip else None
        except (ipaddress.NetmaskValueError, ValueError):
            mask_prefix = None
        if mask_prefix is None:
            rep.error(where, "%s.mask %r is not a valid dotted-decimal mask" % (tag, cells["mask"]))
            return None
        if prefix is not None and prefix != mask_prefix:
            rep.error(where, "%s: mask %s does not match prefix /%d" % (tag, cells["mask"], prefix))
            return None
        prefix = mask_prefix
    addrs = {}
    for col in ("network", "first", "last", "broadcast"):
        if col in cells:
            addrs[col] = parse_ip(cells[col])
            if addrs[col] is None:
                rep.error(where, "%s.%s %r is not an IPv4 address" % (tag, col, cells[col]))
                return None
    hosts = None
    if "hosts" in cells:
        h = cells["hosts"].strip().replace(",", "")
        if not re.fullmatch(r"[0-9]{1,10}", h):
            rep.error(where, "%s.hosts %r is not a number" % (tag, cells["hosts"]))
            return None
        hosts = int(h)
    if prefix is None and "network" in addrs and "broadcast" in addrs:
        size = int(addrs["broadcast"]) - int(addrs["network"]) + 1
        if size >= 1 and size & (size - 1) == 0:
            prefix = 32 - (size.bit_length() - 1)
        else:
            rep.error(where, "%s: network and broadcast do not delimit a valid subnet" % tag)
            return None
    if prefix is None and hosts is not None and (hosts + 2) & (hosts + 1) == 0 and hosts >= 2:
        prefix = 32 - (hosts + 2).bit_length() + 1
    if prefix is None or not addrs:
        if prefix is not None and hosts is not None:
            expect = max(0, 2 ** (32 - prefix) - 2)
            if hosts != expect:
                rep.error(where, "%s.hosts is %d, expected %d for /%d" % (tag, hosts, expect, prefix))
        else:
            rep.warn(where, "%s cannot be verified (needs a prefix or mask and at least one address)" % tag)
        return None
    if prefix > 30:
        rep.warn(where, "%s uses /%d: first/last/hosts are not checked" % (tag, prefix))
        return None
    anchor = addrs.get("network") or addrs.get("first") or addrs.get("last") or addrs.get("broadcast")
    net = ipaddress.IPv4Network("%s/%d" % (anchor, prefix), strict=False)
    expected = {
        "network": net.network_address,
        "first": net.network_address + 1,
        "last": net.broadcast_address - 1,
        "broadcast": net.broadcast_address,
    }
    for col, value in addrs.items():
        if value != expected[col]:
            rep.error(where, "%s.%s is %s, expected %s for %s" % (tag, col, value, expected[col], net))
    if hosts is not None and hosts != net.num_addresses - 2:
        rep.error(where, "%s.hosts is %d, expected %d for %s" % (tag, hosts, net.num_addresses - 2, net))
    return net


def check_subnet(rep, where, item):
    data, answer = item.get("data"), item.get("answer")
    only_keys(rep, where, data, ("prompt", "columns", "rows"), "data")
    only_keys(rep, where, answer, ("rows",), "answer")
    check_text(rep, where, data.get("prompt"), 1, 400, "data.prompt")
    cols = data.get("columns")
    if (not isinstance(cols, list) or not cols or any(c not in SUBNET_COLS for c in cols)
            or len(set(cols)) != len(cols)):
        rep.error(where, "data.columns must be unique names from: %s" % ", ".join(SUBNET_COLS))
        raise Bad()
    row_ids = part_list(rep, where, data.get("rows"), 2, 5, "label", "data.rows")
    rows = answer.get("rows")
    if not isinstance(rows, dict) or sorted(rows) != sorted(row_ids):
        rep.error(where, "answer.rows must have exactly one entry per row id")
        raise Bad()
    nets = []
    for rid in row_ids:
        cells = rows[rid]
        if not isinstance(cells, dict) or sorted(cells) != sorted(cols):
            rep.error(where, "answer.rows.%s must have exactly the declared columns" % rid)
            continue
        good = True
        for col in cols:
            if not check_text(rep, where, cells[col], 1, 40, "answer.rows.%s.%s" % (rid, col)):
                good = False
        if good:
            net = check_subnet_row(rep, where, rid, cells)
            if net is not None:
                nets.append((rid, net))
    for i, (rid_a, net_a) in enumerate(nets):
        for rid_b, net_b in nets[i + 1:]:
            if net_a.overlaps(net_b):
                rep.warn(where, "rows %s (%s) and %s (%s) overlap" % (rid_a, net_a, rid_b, net_b))


def check_item(rep, where, item, file_domain, objectives, seen_ids):
    only_keys(rep, where, item, ITEM_KEYS, "item")
    iid = item.get("id")
    match = ITEM_ID_RE.match(iid) if isinstance(iid, str) else None
    if not match:
        rep.error(where, "id %r does not match N9-<objective>-<4 digits>" % (iid,))
    else:
        if iid in seen_ids:
            rep.error(where, "duplicate id (also in %s)" % seen_ids[iid])
        seen_ids.setdefault(iid, where)
    objective = item.get("objective")
    if not isinstance(objective, str) or objective not in objectives:
        rep.error(where, "objective %r is not one of the 25 objective ids" % (objective,))
        objective = None
    elif match and match.group(1) != objective:
        rep.error(where, "the id says objective %s but 'objective' is %s" % (match.group(1), objective))
    domain = item.get("domain")
    if not is_int(domain) or not 1 <= domain <= 5:
        rep.error(where, "domain must be an integer 1-5")
    else:
        if objective and str(domain) != objective[0]:
            rep.error(where, "domain %d does not match objective %s" % (domain, objective))
        if domain != file_domain:
            rep.error(where, "domain %d is in the file of domain %d" % (domain, file_domain))
    itype = item.get("type")
    if itype not in TYPES:
        rep.error(where, "type %r is not one of %s" % (itype, ", ".join(TYPES)))
    if "drill" in item and item["drill"] is not True:
        rep.error(where, "drill must be true when present (quick drills are practice-only)")
    if item.get("drill") is True and itype in PBQ_TYPES:
        rep.error(where, "a quick drill cannot be a PBQ")
    if not is_int(item.get("difficulty")) or item.get("difficulty") not in (1, 2, 3):
        rep.error(where, "difficulty must be 1, 2 or 3")
    if check_text(rep, where, item.get("stem"), 20, 1200, "stem"):
        if LOWER_NEG_RE.search(item["stem"]):
            rep.warn(where, "the stem has a lower-case ' not ' or ' except ' (negative stems use NOT / EXCEPT)")
    check_text(rep, where, item.get("explanation"), 20, 1500, "explanation")
    exhibit = item.get("exhibit")
    if exhibit is not None:
        only_keys(rep, where, exhibit, ("title", "lines"), "exhibit")
        check_text(rep, where, exhibit.get("title"), 1, 120, "exhibit.title")
        lines = exhibit.get("lines")
        if not isinstance(lines, list) or not 1 <= len(lines) <= 40:
            rep.error(where, "exhibit.lines must be a list of 1-40 lines")
        else:
            for n, line in enumerate(lines, 1):
                # CLI output legitimately contains < and > (interface flags); it is rendered as text.
                check_text(rep, where, line, 0, 120, "exhibit line %d" % n, allow_angle=True)
    if itype not in TYPES:
        return None
    if not isinstance(item.get("answer"), dict):
        rep.error(where, "answer must be an object")
        return itype
    if itype in PBQ_TYPES:
        for key in ("options", "selectCount"):
            if key in item:
                rep.error(where, "'%s' is not allowed on a %s item" % (key, itype))
        {"order": check_order, "match": check_match, "subnet": check_subnet}[itype](rep, where, item)
    else:
        check_choice(rep, where, item)
    return itype


def load_json(rep, path, name):
    try:
        size = os.path.getsize(path)
        if size >= MAX_FILE_BYTES:
            rep.error(name, "file is %d bytes (limit %d)" % (size, MAX_FILE_BYTES))
            return None
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle, object_pairs_hook=lambda pairs: no_dupes(rep, name, pairs))
    except (OSError, ValueError) as exc:
        rep.error(name, "cannot be read as UTF-8 JSON: %s" % exc)
        return None


def no_dupes(rep, name, pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            rep.error(name, "duplicate JSON key %r" % key)
        if key in ("__proto__",):
            rep.error(name, "forbidden JSON key %r" % key)
        out[key] = value
    return out


def check_meta(rep, data_dir):
    """objectives.json and domains.json. Returns the set of objective ids."""
    objectives = load_json(rep, os.path.join(data_dir, "objectives.json"), "objectives.json")
    ids = []
    if not isinstance(objectives, list):
        rep.error("objectives.json", "must be a list of 25 objectives")
    else:
        for obj in objectives:
            where = "objectives.json"
            if not isinstance(obj, dict) or set(obj) != {"id", "domain", "title"}:
                rep.error(where, "each entry needs exactly id, domain, title")
                continue
            if obj["id"] not in OBJECTIVE_IDS or obj["id"] in ids:
                rep.error(where, "unknown or duplicate objective id %r" % (obj["id"],))
                continue
            ids.append(obj["id"])
            if obj["domain"] != int(obj["id"][0]):
                rep.error(where, "%s: domain does not match the id" % obj["id"])
            if check_text(rep, where, obj["title"], 1, 90, "%s title" % obj["id"]) and len(obj["title"].split()) > 8:
                rep.error(where, "%s: title has more than 8 words" % obj["id"])
        if sorted(ids) != sorted(OBJECTIVE_IDS):
            rep.error("objectives.json", "must contain exactly the 25 objective ids")
    domains = load_json(rep, os.path.join(data_dir, "domains.json"), "domains.json")
    if not isinstance(domains, list) or len(domains) != 5:
        rep.error("domains.json", "must be a list of 5 domains")
    else:
        for n, dom in enumerate(domains, 1):
            if not isinstance(dom, dict) or set(dom) != {"id", "title", "weight"} or dom["id"] != n:
                rep.error("domains.json", "entry %d needs exactly id (%d), title, weight" % (n, n))
                continue
            check_text(rep, "domains.json", dom["title"], 1, 60, "domain %d title" % n)
            if dom["weight"] != DOMAIN_WEIGHTS[n]:
                rep.error("domains.json", "domain %d weight must be %d" % (n, DOMAIN_WEIGHTS[n]))
    return set(OBJECTIVE_IDS)


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    strict = "--strict" in argv
    here = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.abspath(args[0]) if args else os.path.join(os.path.dirname(here), "data")
    rep = Report()
    if not os.path.isdir(data_dir):
        print("ERROR   data directory not found: %s" % data_dir)
        return 1
    objectives = check_meta(rep, data_dir)

    per_domain = {n: 0 for n in range(1, 6)}
    per_type = {t: 0 for t in TYPES}
    per_objective = {o: 0 for o in OBJECTIVE_IDS}
    seen_ids = {}
    drills = {n: 0 for n in range(1, 6)}
    files = 0
    for name in sorted(os.listdir(data_dir)):
        if not (name.startswith("domain-") and name.endswith(".json")):
            continue
        m = re.fullmatch(r"domain-([1-5])\.json", name)
        if not m:
            rep.error(name, "unexpected file name (expected domain-1.json ... domain-5.json)")
            continue
        files += 1
        file_domain = int(m.group(1))
        bank = load_json(rep, os.path.join(data_dir, name), name)
        if bank is None:
            continue
        if not isinstance(bank, dict):
            rep.error(name, "top level must be an object")
            continue
        extra = sorted(set(bank) - {"schemaVersion", "exam", "domain", "items"})
        if extra:
            rep.error(name, "unknown top-level key(s): %s" % ", ".join(extra))
        if bank.get("schemaVersion") != 1 or isinstance(bank.get("schemaVersion"), bool):
            rep.error(name, "schemaVersion must be 1")
        if bank.get("exam") != EXAM:
            rep.error(name, "exam must be %s" % EXAM)
        if bank.get("domain") != file_domain:
            rep.error(name, "domain must be %d" % file_domain)
        items = bank.get("items")
        if not isinstance(items, list):
            rep.error(name, "items must be a list")
            continue
        if not items:
            rep.warn(name, "no items")
        for index, item in enumerate(items, 1):
            iid = item.get("id") if isinstance(item, dict) else None
            where = "%s #%d (%s)" % (name, index, iid if isinstance(iid, str) and len(iid) < 40 else "no id")
            before = len(rep.errors)
            itype = None
            try:
                itype = check_item(rep, where, item, file_domain, objectives, seen_ids)
            except Bad:
                pass
            if len(rep.errors) == before and itype and item.get("drill") is True:
                drills[file_domain] += 1
            elif len(rep.errors) == before and itype:
                per_domain[file_domain] += 1
                per_type[itype] += 1
                per_objective[item["objective"]] += 1
    if files == 0:
        rep.error(data_dir, "no domain-N.json file found")
    for n in range(1, 6):
        if not os.path.isfile(os.path.join(data_dir, "domain-%d.json" % n)):
            rep.warn("domain-%d.json" % n, "file is missing")

    for line in rep.warnings:
        print(line)
    for line in rep.errors:
        print(line)
    total = sum(per_domain.values())
    print("")
    print("Valid items: %d exam-style, plus %d quick drills (practice only: %s)" % (
        total, sum(drills.values()), "  ".join("%d: %d" % (n, drills[n]) for n in range(1, 6))))
    print("Per domain:    " + "  ".join("%d: %d" % (n, per_domain[n]) for n in range(1, 6)))
    print("Per type:      " + "  ".join("%s: %d" % (t, per_type[t]) for t in TYPES))
    print("Per objective:")
    for n in range(1, 6):
        print("  " + "  ".join("%s: %d" % (o, per_objective[o]) for o in OBJECTIVE_IDS if o[0] == str(n)))
    empty = [o for o in OBJECTIVE_IDS if per_objective[o] == 0]
    if empty and total:
        print("Objectives without any item: " + ", ".join(empty))
    print("")
    print("%d error(s), %d warning(s)" % (len(rep.errors), len(rep.warnings)))
    failed = bool(rep.errors) or (strict and bool(rep.warnings))
    print("RESULT: %s" % ("FAIL" if failed else "OK"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
