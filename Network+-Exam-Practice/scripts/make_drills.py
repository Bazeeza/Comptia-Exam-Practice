"""Generate the quick-drill items (ports and acronyms) into data/domain-N.json.

Drill items carry "drill": true. The simulator offers them in Practice mode only
("Quick drills" question type); Exam mode never draws them.

Run from anywhere:  python -I Network+-Exam-Practice/scripts/make_drills.py
It replaces every existing drill item (ids N9-x.y-05nn) and keeps all other items.
The output is deterministic (fixed random seed), so re-running gives the same files.
"""
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
FIRST_DRILL_NUM = 500
rng = random.Random(10009)

# Port table of objective 1.4: (service, full name, ports as text, transport note).
PORTS = [
    ("FTP", "File Transfer Protocol", "20 and 21", "TCP"),
    ("SFTP", "Secure File Transfer Protocol", "22", "TCP"),
    ("SSH", "Secure Shell", "22", "TCP"),
    ("Telnet", "Telnet", "23", "TCP"),
    ("SMTP", "Simple Mail Transfer Protocol", "25", "TCP"),
    ("DNS", "Domain Name System", "53", "UDP and TCP"),
    ("DHCP", "Dynamic Host Configuration Protocol", "67 and 68", "UDP"),
    ("TFTP", "Trivial File Transfer Protocol", "69", "UDP"),
    ("HTTP", "Hypertext Transfer Protocol", "80", "TCP"),
    ("NTP", "Network Time Protocol", "123", "UDP"),
    ("SNMP", "Simple Network Management Protocol", "161 and 162", "UDP"),
    ("LDAP", "Lightweight Directory Access Protocol", "389", "TCP and UDP"),
    ("HTTPS", "Hypertext Transfer Protocol Secure", "443", "TCP"),
    ("SMB", "Server Message Block", "445", "TCP"),
    ("Syslog", "Syslog", "514", "UDP"),
    ("SMTPS", "Simple Mail Transfer Protocol Secure", "587", "TCP"),
    ("LDAPS", "Lightweight Directory Access Protocol over SSL", "636", "TCP"),
    ("SQL Server", "Structured Query Language Server", "1433", "TCP"),
    ("RDP", "Remote Desktop Protocol", "3389", "TCP"),
    ("SIP", "Session Initiation Protocol", "5060 and 5061", "TCP and UDP"),
]

# Acronym groups: (objective, [(acronym, expansion, short description)]).
# Options of a question come from the same group, so distractors are plausible.
ACRONYMS = [
    ("1.4", [
        ("ICMP", "Internet Control Message Protocol", "carries error and diagnostic messages such as echo request and echo reply used by ping"),
        ("GRE", "Generic Routing Encapsulation", "wraps one packet inside another to build a simple tunnel, without encryption"),
        ("AH", "Authentication Header", "is the IPSec protocol that provides integrity and authentication but no encryption"),
        ("ESP", "Encapsulating Security Payload", "is the IPSec protocol that encrypts the payload and can also authenticate it"),
        ("IKE", "Internet Key Exchange", "negotiates the keys and security associations used by IPSec"),
        ("UDP", "User Datagram Protocol", "is the connectionless transport protocol with no handshake and no delivery guarantee"),
    ]),
    ("1.2", [
        ("IDS", "Intrusion Detection System", "watches traffic and raises alerts on suspicious activity without blocking it"),
        ("IPS", "Intrusion Prevention System", "sits inline and can block malicious traffic as it passes"),
        ("NAS", "Network-Attached Storage", "is a file-level storage device shared over the regular LAN"),
        ("SAN", "Storage Area Network", "is a dedicated network that gives servers block-level access to storage"),
        ("CDN", "Content Delivery Network", "caches content on servers close to users to speed up delivery"),
        ("NGFW", "Next-Generation Firewall", "is a firewall that adds application awareness and intrusion prevention to stateful filtering"),
    ]),
    ("1.3", [
        ("SaaS", "Software as a Service", "is the cloud model where the provider runs a complete application that users simply log in to"),
        ("PaaS", "Platform as a Service", "is the cloud model where the provider manages the runtime and the customer deploys their own code"),
        ("IaaS", "Infrastructure as a Service", "is the cloud model where the customer rents virtual machines, storage and networks and manages the OS"),
        ("VPC", "Virtual Private Cloud", "is an isolated private network that a customer defines inside a public cloud"),
        ("NFV", "Network Functions Virtualization", "runs network functions such as firewalls and routers as software on standard servers"),
    ]),
    ("1.5", [
        ("SFP", "Small Form-factor Pluggable", "is a hot-swappable transceiver module, typically for 1 Gbps links"),
        ("QSFP", "Quad Small Form-factor Pluggable", "is a transceiver module that combines four lanes for 40 Gbps and faster links"),
        ("DAC", "Direct Attach Copper", "is a short copper twinax cable with transceivers fixed on both ends"),
        ("UTP", "Unshielded Twisted Pair", "is the common copper cabling with twisted pairs and no foil or braid shielding"),
        ("SMF", "Single-Mode Fiber", "is fiber with a very small core, used for long-distance links with laser light"),
        ("MMF", "Multimode Fiber", "is fiber with a larger core, used for shorter links within a building or campus"),
    ]),
    ("1.6", [
        ("SDN", "Software-Defined Networking", "separates the control plane from the data plane so a central controller programs the network"),
        ("WAN", "Wide Area Network", "connects sites across large geographic distances"),
        ("MAN", "Metropolitan Area Network", "connects sites across a city or metro area"),
        ("PAN", "Personal Area Network", "covers a few meters around one person, for example Bluetooth devices"),
        ("WLAN", "Wireless Local Area Network", "is a local network that connects devices over Wi-Fi"),
    ]),
    ("1.7", [
        ("APIPA", "Automatic Private IP Addressing", "gives a host a 169.254.x.x address when no DHCP server answers"),
        ("NAT", "Network Address Translation", "rewrites IP addresses as packets cross a router, for example private to public"),
        ("PAT", "Port Address Translation", "lets many private hosts share one public address by tracking source ports"),
        ("VLSM", "Variable Length Subnet Mask", "uses different mask lengths within one address block to fit each subnet's size"),
        ("CIDR", "Classless Inter-Domain Routing", "writes networks as an address plus a prefix length, such as /24, instead of classes"),
    ]),
    ("1.8", [
        ("SD-WAN", "Software-Defined Wide Area Network", "steers traffic over several WAN links with central, application-aware policies"),
        ("VXLAN", "Virtual Extensible LAN", "carries layer 2 frames over a layer 3 network, with up to about 16 million segments"),
        ("ZTA", "Zero Trust Architecture", "never trusts a request by its location and verifies every access explicitly"),
        ("SASE", "Secure Access Service Edge", "combines SD-WAN with cloud-delivered security services"),
        ("IaC", "Infrastructure as Code", "defines servers and network settings in files that tools apply automatically"),
    ]),
    ("2.1", [
        ("OSPF", "Open Shortest Path First", "is a link-state interior routing protocol that uses cost as its metric"),
        ("BGP", "Border Gateway Protocol", "is the path-vector protocol that exchanges routes between autonomous systems on the internet"),
        ("EIGRP", "Enhanced Interior Gateway Routing Protocol", "is an advanced distance-vector protocol originally from Cisco"),
        ("FHRP", "First Hop Redundancy Protocol", "lets several routers share one virtual default gateway address"),
        ("AD", "Administrative Distance", "is the value a router uses to prefer one route source over another"),
    ]),
    ("2.2", [
        ("VLAN", "Virtual Local Area Network", "splits one physical switch into separate broadcast domains"),
        ("STP", "Spanning Tree Protocol", "blocks redundant switch paths to prevent layer 2 loops"),
        ("LACP", "Link Aggregation Control Protocol", "bundles several physical links into one logical link"),
        ("MTU", "Maximum Transmission Unit", "is the largest packet size an interface sends without fragmenting"),
        ("SVI", "Switch Virtual Interface", "is a layer 3 interface on a switch for a VLAN, often used as its gateway"),
    ]),
    ("2.3", [
        ("SSID", "Service Set Identifier", "is the network name a wireless access point advertises"),
        ("WPA3", "Wi-Fi Protected Access 3", "is the current Wi-Fi security standard, using SAE instead of a pre-shared key handshake"),
        ("PSK", "Pre-Shared Key", "is a single passphrase that every wireless client uses to join"),
        ("BSSID", "Basic Service Set Identifier", "is the MAC address of one access point radio"),
        ("MIMO", "Multiple Input, Multiple Output", "uses several antennas at once to send and receive more data"),
    ]),
    ("2.4", [
        ("UPS", "Uninterruptible Power Supply", "keeps equipment running on battery for a short time when utility power fails"),
        ("PDU", "Power Distribution Unit", "distributes power to the devices inside a rack"),
        ("HVAC", "Heating, Ventilation and Air Conditioning", "controls temperature and humidity in a server room"),
        ("IDF", "Intermediate Distribution Frame", "is a wiring closet that serves one floor or area and links back to the main frame"),
        ("MDF", "Main Distribution Frame", "is the central wiring point where the building connects to outside lines"),
    ]),
    ("3.1", [
        ("SLA", "Service Level Agreement", "states the level of service a provider commits to, such as uptime"),
        ("MOU", "Memorandum of Understanding", "records a non-binding agreement of intent between two parties"),
        ("NDA", "Non-Disclosure Agreement", "is a contract that forbids sharing confidential information"),
        ("EOL", "End-of-Life", "is the point after which a product is no longer sold or developed"),
        ("IPAM", "IP Address Management", "tracks and plans the IP addresses used on a network"),
    ]),
    ("3.2", [
        ("SIEM", "Security Information and Event Management", "collects and correlates logs from many sources to detect incidents"),
        ("MIB", "Management Information Base", "is the database of objects that SNMP can read or set on a device"),
        ("OID", "Object Identifier", "is the numeric name of a single value inside an SNMP MIB"),
        ("API", "Application Programming Interface", "lets programs query or configure a device or service"),
        ("SPAN", "Switched Port Analyzer", "copies traffic from switch ports to a monitoring port"),
    ]),
    ("3.3", [
        ("RPO", "Recovery Point Objective", "is the maximum amount of data, measured in time, that can be lost"),
        ("RTO", "Recovery Time Objective", "is the maximum time allowed to restore a service after an outage"),
        ("MTTR", "Mean Time to Repair", "is the average time needed to fix a failed component"),
        ("MTBF", "Mean Time Between Failures", "is the average time a repairable device runs between failures"),
    ]),
    ("3.4", [
        ("DORA", "Discover, Offer, Request, Acknowledge", "is the four-message exchange a client uses to obtain a DHCP lease"),
        ("PTR", "Pointer record", "maps an IP address back to a host name in reverse DNS"),
        ("MX", "Mail Exchanger record", "names the mail server that accepts email for a domain"),
        ("TTL", "Time to Live", "is how long a DNS answer may stay in a cache"),
        ("DNSSEC", "Domain Name System Security Extensions", "signs DNS records so resolvers can detect tampered answers"),
        ("DoH", "DNS over HTTPS", "sends DNS queries inside encrypted HTTPS traffic"),
    ]),
    ("3.5", [
        ("VPN", "Virtual Private Network", "builds an encrypted tunnel across an untrusted network"),
        ("GUI", "Graphical User Interface", "manages a device through windows and menus instead of commands"),
        ("CLI", "Command-Line Interface", "manages a device by typing text commands"),
        ("OOB", "Out-of-Band management", "reaches a device through a separate path, such as a console server, when the main network is down"),
    ]),
    ("4.1", [
        ("CIA", "Confidentiality, Integrity and Availability", "is the triad of goals that security controls protect"),
        ("MFA", "Multifactor Authentication", "requires two or more different kinds of proof, such as a password and a code"),
        ("SSO", "Single Sign-On", "lets a user log in once and reach many applications"),
        ("RADIUS", "Remote Authentication Dial-In User Service", "is the AAA protocol over UDP, often used for Wi-Fi and VPN logins"),
        ("TACACS+", "Terminal Access Controller Access-Control System Plus", "is the AAA protocol over TCP that encrypts the whole payload, often used for device administration"),
        ("PKI", "Public Key Infrastructure", "issues and manages digital certificates through certificate authorities"),
        ("RBAC", "Role-Based Access Control", "grants permissions according to a user's job role"),
    ]),
    ("4.2", [
        ("DDoS", "Distributed Denial-of-Service", "floods a target from many sources at once to make it unavailable"),
        ("MITM", "Man-in-the-Middle", "is an attack where someone secretly sits between two parties to read or change traffic"),
        ("ARP", "Address Resolution Protocol", "maps IP addresses to MAC addresses, and can be poisoned to redirect traffic"),
        ("MAC", "Media Access Control", "is the hardware address used on the local segment, which can be flooded or spoofed"),
    ]),
    ("4.3", [
        ("NAC", "Network Access Control", "checks a device's identity and health before it gets network access"),
        ("ACL", "Access Control List", "is an ordered list of permit and deny rules applied to traffic"),
        ("DMZ", "Demilitarized Zone", "is a screened subnet that holds public-facing servers apart from the internal network"),
        ("EAP", "Extensible Authentication Protocol", "is the framework that 802.1X uses to carry authentication methods"),
    ]),
    ("5.2", [
        ("PoE", "Power over Ethernet", "sends electrical power along the same twisted-pair cable as data"),
        ("CRC", "Cyclic Redundancy Check", "is the frame checksum; rising errors often point to a bad cable or interference"),
        ("EMI", "Electromagnetic Interference", "is noise from nearby electrical sources that corrupts signals on copper"),
        ("NEXT", "Near-End Crosstalk", "is signal leaking between pairs, measured at the same end as the transmitter"),
    ]),
    ("5.4", [
        ("RSSI", "Received Signal Strength Indicator", "measures how strong a wireless signal is at the receiver"),
        ("SNR", "Signal-to-Noise Ratio", "compares the wanted signal to the background noise"),
        ("QoS", "Quality of Service", "prioritizes some traffic, such as voice, over other traffic"),
        ("EIRP", "Effective Isotropic Radiated Power", "is the total power an antenna radiates, counting the antenna gain"),
    ]),
]


def ports_value(text):
    return text


def port_items():
    items = []
    num = FIRST_DRILL_NUM
    values = sorted({p[2] for p in PORTS}, key=lambda v: int(v.split()[0]))
    owners = {}
    for p in PORTS:
        owners.setdefault(p[2], []).append(p[0])

    def owner_text(value):
        names = owners[value]
        return " and ".join(names)

    # Service -> port.
    for svc, full, value, transport in PORTS:
        wrong = rng.sample([v for v in values if v != value], 3)
        opts = [value] + wrong
        rng.shuffle(opts)
        options = []
        for i, v in enumerate(opts):
            oid = "abcd"[i]
            if v == value:
                why = "Correct. %s (%s) uses %s %s." % (svc, full, transport, v) if svc != full else "Correct. %s uses %s %s." % (svc, transport, v)
            else:
                why = ("Ports %s are the default for %s." if " and " in v else "Port %s is the default for %s.") % (v, owner_text(v))
            options.append({"id": oid, "text": v, "why": why})
        correct = "abcd"[opts.index(value)]
        name = "%s (%s)" % (full, svc) if svc != full else svc
        items.append({
            "id": "N9-1.4-%04d" % num, "domain": 1, "objective": "1.4", "type": "single", "difficulty": 1,
            "drill": True,
            "stem": "Quick drill: which default port number(s) does %s use?" % name,
            "options": options, "answer": {"correct": [correct]},
            "explanation": "%s uses %s %s by default." % (name, transport, value),
        })
        num += 1

    # Port -> service. Skip the shared port 22 in this direction to avoid two right answers.
    services = [p for p in PORTS if p[2] != "22"]
    for svc, full, value, transport in services:
        others = [p for p in services if p[2] != value]
        wrong = rng.sample(others, 3)
        opts = [(svc, value)] + [(w[0], w[2]) for w in wrong]
        rng.shuffle(opts)
        options = []
        for i, (s, v) in enumerate(opts):
            why = ("Correct. %s %s is the default for %s." % (transport, value, svc)) if s == svc else ("%s uses %s." % (s, v))
            options.append({"id": "abcd"[i], "text": s, "why": why})
        correct = "abcd"[[o[0] for o in opts].index(svc)]
        plural = " and " in value
        items.append({
            "id": "N9-1.4-%04d" % num, "domain": 1, "objective": "1.4", "type": "single", "difficulty": 1,
            "drill": True,
            "stem": "Quick drill: a firewall log shows traffic on %s port%s %s. Which service uses %s by default?" % (
                transport, "s" if plural else "", value, "these ports" if plural else "this port"),
            "options": options, "answer": {"correct": [correct]},
            "explanation": "%s %s is the default for %s%s." % (transport, value, svc, "" if svc == full else " (%s)" % full),
        })
        num += 1
    return items


def acronym_items(first_free_14):
    items = []
    counters = {"1.4": first_free_14}
    for objective, group in ACRONYMS:
        for acr, full, desc in group:
            others = [g for g in group if g[0] != acr]
            wrong = rng.sample(others, min(3, len(others)))
            opts = [(acr, full, desc)] + wrong
            rng.shuffle(opts)
            options = []
            for i, (a, f, d) in enumerate(opts):
                why = ("Correct. %s stands for %s." % (a, f)) if a == acr else ("%s (%s) %s." % (a, f, d))
                options.append({"id": "abcd"[i], "text": a, "why": why})
            correct = "abcd"[[o[0] for o in opts].index(acr)]
            n = counters.get(objective, FIRST_DRILL_NUM)
            counters[objective] = n + 1
            items.append({
                "id": "N9-%s-%04d" % (objective, n), "domain": int(objective[0]), "objective": objective,
                "type": "single", "difficulty": 1, "drill": True,
                "stem": "Quick drill: which acronym matches this description? It %s." % desc,
                "options": options, "answer": {"correct": [correct]},
                "explanation": "%s stands for %s. It %s." % (acr, full, desc),
            })
    return items


def main():
    ports = port_items()
    drills = ports + acronym_items(FIRST_DRILL_NUM + len(ports))
    by_domain = {}
    for it in drills:
        by_domain.setdefault(it["domain"], []).append(it)
    for d in range(1, 6):
        path = os.path.join(DATA, "domain-%d.json" % d)
        with open(path, encoding="utf-8") as f:
            bank = json.load(f)
        kept = [it for it in bank["items"] if not it.get("drill")]
        bank["items"] = kept + by_domain.get(d, [])
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(bank, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("domain-%d.json: %d exam-style items, %d drills" % (d, len(kept), len(by_domain.get(d, []))))
    print("Total drills: %d" % len(drills))


if __name__ == "__main__":
    main()
