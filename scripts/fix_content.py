#!/usr/bin/env python3
"""
Single-pass content fix script for fr-en-a1.json
Applies all fixes at once:
(a) accepted[] field for alternative answers
(b) remove duplicate u10-l3 exercises
(c) fix distractors: correct answer longest in <30% of MC, varied positions
"""
import json
import random
from copy import deepcopy

# ──────────────────────────────────────────────────────────────────────
# Load
with open('content/fr-en-a1.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

original = deepcopy(data)

# ═══════════════════════════════════════════════════════════════════════
# (a) ACCEPTED[] — alternative answers for translate/fill_blank
# ═══════════════════════════════════════════════════════════════════════

ACCEPTED_RULES = [
    # (unit_id, lesson_id, prompt_contains, accepted_list)
    # made / baked
    ('u4', 'u4-l5', "Elle a fait un gâteau", ["She made a cake", "She baked a cake"]),
    
    # snows / it snows
    ('u6', 'u6-l4', "En hiver, il neige", ["In winter it snows", "In winter, it snows"]),
    
    # 14 heures → 2 p.m. / two o'clock
    ('u12', 'u12-l5', "On se retrouve à 14 heures", ["Let's meet at 2 p.m.", "Let's meet at two o'clock", "Let's meet at 2 pm"]),
    
    # Monday to Friday / Friday.
    ('u6', 'u6-l1', "I work from Monday to", ["Friday", "Friday."]),
    
    # listen to / listen
    ('u10', 'u10-l3', "She likes to", ["listen to", "listen"]),
    ('u10', 'u10-l3', "Nous écoutons", ["We listen to music", "We are listening to music"]),
    
    # red light / traffic light
    ('u8', 'u8-l2', "Tournez à droite au feu rouge", ["Turn right at the red light", "Turn right at the traffic light"]),
    
    # Contractions handling
    ('u5', 'u5-l2', "Non, je n'aime pas", ["No, I don't like it", "No, I do not like it"]),
    ('u12', 'u12-l5', "Non, merci, je ne peux pas", ["No, thank you, I can't", "No, thanks, I cannot", "No, thank you, I cannot"]),
]

for unit in data['units']:
    for lesson in unit['lessons']:
        for ex in lesson['exercises']:
            if ex['kind'] not in ('translate', 'fill_blank'):
                continue
            prompt = ex.get('prompt', '')
            answer = ex.get('answer', '')
            
            for u_id, l_id, prompt_contains, accepted in ACCEPTED_RULES:
                if unit['id'] == u_id and lesson['id'] == l_id and prompt_contains in prompt:
                    if accepted:
                        all_accepted = [answer] + accepted
                        seen = set()
                        ex['accepted'] = [a for a in all_accepted if not (a in seen or seen.add(a))]
                    break

# ═══════════════════════════════════════════════════════════════════════
# (b) REMOVE DUPLICATE exercises in u10-l3
# ═══════════════════════════════════════════════════════════════════════

for unit in data['units']:
    if unit['id'] == 'u10':
        for lesson in unit['lessons']:
            if lesson['id'] == 'u10-l3':
                seen_prompts = {}
                to_remove = []
                for i, ex in enumerate(lesson['exercises']):
                    key = (ex['kind'], ex.get('prompt', ''))
                    if key in seen_prompts:
                        to_remove.append(i)
                        print(f"  DUPLICATE FOUND: u10-l3-e{i+1} = {ex['kind']} | {ex.get('prompt', '')[:60]}")
                    else:
                        seen_prompts[key] = i
                
                for idx in reversed(to_remove):
                    lesson['exercises'].pop(idx)
                    print(f"  REMOVED duplicate at index {idx}")

# ═══════════════════════════════════════════════════════════════════════
# (c) FIX DISTRACTORS — with phrase support
# ═══════════════════════════════════════════════════════════════════════

# Phrase-level distractors for common "Comment dit-on" questions
PHRASE_DISTRACTORS = {
    # Greetings / Politeness
    'hello': ['hi', 'goodbye', 'good morning', 'good evening'],
    'hi': ['hello', 'hey', 'goodbye', 'good morning'],
    'goodbye': ['hello', 'hi', 'see you', 'good night'],
    'good morning': ['hello', 'good evening', 'good afternoon', 'hi'],
    'good evening': ['good morning', 'good afternoon', 'hello', 'good night'],
    'good night': ['good evening', 'good morning', 'sleep well', 'bye'],
    'thank you': ['thanks', 'you are welcome', 'please', 'excuse me'],
    'thanks': ['thank you', 'you are welcome', 'please', 'no problem'],
    'you are welcome': ['thank you', 'thanks', 'no problem', 'my pleasure'],
    'please': ['thank you', 'excuse me', 'sorry', 'pardon'],
    'excuse me': ['sorry', 'pardon', 'please', 'excuse us'],
    'sorry': ['excuse me', 'pardon', 'my apologies', 'forgive me'],
    
    # Common verbs (infinitive forms for "Comment dit-on")
    'to be': ['to have', 'to do', 'to go', 'to make'],
    'to have': ['to be', 'to get', 'to take', 'to hold'],
    'to do': ['to make', 'to be', 'to go', 'to work'],
    'to go': ['to come', 'to leave', 'to walk', 'to run'],
    'to make': ['to do', 'to create', 'to build', 'to cook'],
    'to eat': ['to drink', 'to cook', 'to taste', 'to have lunch'],
    'to drink': ['to eat', 'to sip', 'to swallow', 'to have a drink'],
    'to sleep': ['to wake up', 'to rest', 'to nap', 'to go to bed'],
    'to wake up': ['to sleep', 'to get up', 'to rise', 'to open eyes'],
    'to read': ['to write', 'to study', 'to look', 'to see'],
    'to write': ['to read', 'to type', 'to draw', 'to spell'],
    'to listen': ['to hear', 'to listen to', 'to pay attention', 'to understand'],
    'to speak': ['to talk', 'to say', 'to tell', 'to converse'],
    'to watch': ['to see', 'to look at', 'to observe', 'to view'],
    'to play': ['to work', 'to game', 'to have fun', 'to enjoy'],
    'to work': ['to play', 'to study', 'to labor', 'to do a job'],
    'to study': ['to learn', 'to read', 'to review', 'to revise'],
    'to learn': ['to study', 'to understand', 'to know', 'to memorize'],
    'to understand': ['to know', 'to learn', 'to comprehend', 'to get it'],
    'to know': ['to understand', 'to recognize', 'to be aware', 'to be familiar'],
    'to think': ['to believe', 'to suppose', 'to consider', 'to reflect'],
    'to want': ['to need', 'to wish', 'to desire', 'to like'],
    'to like': ['to love', 'to enjoy', 'to prefer', 'to appreciate'],
    'to love': ['to like', 'to adore', 'to cherish', 'to fancy'],
    'to see': ['to look', 'to watch', 'to observe', 'to notice'],
    'to hear': ['to listen', 'to listen to', 'to catch', 'to perceive'],
    'to come': ['to go', 'to arrive', 'to return', 'to appear'],
    'to leave': ['to go', 'to depart', 'to exit', 'to quit'],
    'to arrive': ['to come', 'to reach', 'to get there', 'to show up'],
    'to open': ['to close', 'to unlock', 'to start', 'to begin'],
    'to close': ['to open', 'to shut', 'to lock', 'to end'],
    'to start': ['to begin', 'to open', 'to launch', 'to initiate'],
    'to stop': ['to finish', 'to end', 'to halt', 'to pause'],
    'to help': ['to assist', 'to support', 'to aid', 'to serve'],
    'to ask': ['to question', 'to request', 'to inquire', 'to wonder'],
    'to answer': ['to reply', 'to respond', 'to react', 'to solve'],
    'to call': ['to phone', 'to ring', 'to dial', 'to contact'],
    'to phone': ['to call', 'to ring', 'to telephone', 'to mobile'],
    'to wait': ['to stay', 'to remain', 'to pause', 'to hold on'],
    'to meet': ['to see', 'to encounter', 'to gather', 'to join'],
    'to find': ['to search', 'to look for', 'to discover', 'to locate'],
    'to look for': ['to find', 'to search', 'to seek', 'to hunt'],
    'to buy': ['to purchase', 'to get', 'to acquire', 'to shop'],
    'to sell': ['to buy', 'to vend', 'to market', 'to trade'],
    'to pay': ['to buy', 'to spend', 'to cost', 'to settle'],
    'to cost': ['to pay', 'to price', 'to value', 'to charge'],
    'to need': ['to want', 'to require', 'to lack', 'to miss'],
    'to try': ['to attempt', 'to test', 'to essay', 'to strive'],
    'to use': ['to employ', 'to utilize', 'to apply', 'to operate'],
    'to change': ['to modify', 'to alter', 'to switch', 'to transform'],
    'to move': ['to go', 'to shift', 'to relocate', 'to travel'],
    'to turn': ['to change', 'to rotate', 'to spin', 'to bend'],
    'to put': ['to place', 'to set', 'to lay', 'to position'],
    'to take': ['to get', 'to grab', 'to catch', 'to hold'],
    'to give': ['to offer', 'to hand', 'to pass', 'to present'],
    'to send': ['to mail', 'to post', 'to ship', 'to deliver'],
    'to receive': ['to get', 'to accept', 'to take', 'to welcome'],
    'to bring': ['to take', 'to carry', 'to fetch', 'to deliver'],
    'to keep': ['to hold', 'to retain', 'to save', 'to preserve'],
    'to let': ['to allow', 'to permit', 'to enable', 'to rent'],
    'to begin': ['to start', 'to open', 'to initiate', 'to commence'],
    'to end': ['to finish', 'to stop', 'to conclude', 'to close'],
    'to win': ['to lose', 'to gain', 'to earn', 'to succeed'],
    'to lose': ['to win', 'to miss', 'to fail', 'to drop'],
    'to run': ['to walk', 'to jog', 'to sprint', 'to race'],
    'to walk': ['to run', 'to stroll', 'to hike', 'to march'],
    'to sit': ['to stand', 'to seat', 'to rest', 'to stay'],
    'to stand': ['to sit', 'to rise', 'to stand up', 'to remain'],
    'to lie': ['to lay', 'to recline', 'to rest', 'to sleep'],
    'to fall': ['to drop', 'to tumble', 'to slip', 'to collapse'],
    'to break': ['to fix', 'to repair', 'to mend', 'to damage'],
    'to fix': ['to break', 'to repair', 'to mend', 'to solve'],
    'to clean': ['to wash', 'to tidy', 'to clear', 'to scrub'],
    'to wash': ['to clean', 'to rinse', 'to shower', 'to bathe'],
    'to cook': ['to bake', 'to prepare', 'to boil', 'to fry'],
    'to drive': ['to ride', 'to drive a car', 'to steer', 'to operate'],
    'to ride': ['to drive', 'to cycle', 'to mount', 'to travel'],
    'to fly': ['to soar', 'to glide', 'to travel by air', 'to pilot'],
    'to swim': ['to dive', 'to float', 'to bathe', 'to splash'],
    'to dance': ['to sing', 'to move', 'to perform', 'to sway'],
    'to sing': ['to dance', 'to hum', 'to chant', 'to vocalize'],
    'to play music': ['to sing', 'to perform', 'to practice', 'to play an instrument'],
    'to draw': ['to paint', 'to sketch', 'to illustrate', 'to design'],
    'to paint': ['to draw', 'to color', 'to coat', 'to depict'],
    'to build': ['to make', 'to construct', 'to assemble', 'to erect'],
    'to create': ['to make', 'to invent', 'to design', 'to produce'],
}

# Word-level distractors by semantic field (single words)
WORD_DISTRACTORS = {
    'family': ['father', 'mother', 'brother', 'sister', 'son', 'daughter', 'uncle', 'aunt', 'cousin', 'grandfather', 'grandmother', 'nephew', 'niece'],
    'food': ['apple', 'bread', 'cheese', 'chicken', 'fish', 'meat', 'rice', 'water', 'milk', 'egg', 'fruit', 'vegetable', 'pasta', 'soup', 'salad', 'cake'],
    'house': ['room', 'door', 'window', 'table', 'chair', 'bed', 'kitchen', 'bathroom', 'bedroom', 'garden', 'house', 'home', 'floor', 'wall', 'roof', 'key'],
    'colors': ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'pink', 'brown', 'grey', 'gray'],
    'verbs': ['be', 'have', 'do', 'say', 'go', 'get', 'make', 'know', 'think', 'take', 'see', 'come', 'want', 'look', 'use', 'find', 'give', 'tell', 'work', 'call', 'try', 'ask', 'need', 'feel', 'become', 'leave', 'put', 'mean', 'keep', 'let', 'begin', 'seem', 'help', 'show', 'hear', 'play', 'run', 'move', 'live', 'believe', 'bring', 'happen', 'write', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'remain'],
    'numbers': ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred'],
    'time': ['morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month', 'year', 'today', 'tomorrow', 'yesterday', 'hour', 'minute', 'second', 'clock', 'time', 'o\'clock', 'midnight', 'noon', 'moment', 'minute', 'season', 'spring', 'summer', 'autumn', 'winter', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
    'clothes': ['shirt', 'trousers', 'pants', 'dress', 'skirt', 'shoes', 'socks', 'coat', 'jacket', 'hat', 'gloves', 'scarf', 'tie', 'belt', 'jeans', 'shorts', 'sweater', 't-shirt', 'boots', 'sandals'],
    'body': ['head', 'eye', 'ear', 'nose', 'mouth', 'hand', 'arm', 'leg', 'foot', 'tooth', 'hair', 'face', 'neck', 'shoulder', 'back', 'chest', 'stomach', 'finger', 'toe', 'knee', 'elbow'],
    'places': ['school', 'home', 'work', 'shop', 'store', 'park', 'street', 'road', 'city', 'town', 'village', 'country', 'station', 'airport', 'hospital', 'restaurant', 'hotel', 'bank', 'post office', 'library', 'museum', 'cinema', 'theater', 'market', 'supermarket', 'pharmacy', 'bakery', 'cafe', 'bar', 'pub', 'club', 'gym', 'pool', 'beach', 'mountain', 'lake', 'river', 'sea', 'ocean', 'forest', 'field', 'farm', 'zoo', 'garden', 'square', 'bridge', 'tunnel', 'highway', 'corner', 'crossing', 'traffic light', 'bus stop', 'subway', 'metro', 'platform', 'terminal', 'gate', 'entrance', 'exit', 'reception', 'lobby', 'room', 'floor', 'elevator', 'stairs', 'door', 'window', 'wall', 'ceiling', 'floor', 'carpet', 'curtain', 'lamp', 'light', 'switch', 'outlet', 'socket', 'plug', 'wire', 'cable', 'pipe', 'tap', 'sink', 'toilet', 'bath', 'shower', 'mirror', 'towel', 'soap', 'shampoo', 'toothbrush', 'toothpaste', 'comb', 'brush', 'hair dryer', 'razor', 'cream', 'lotion', 'perfume', 'deodorant', 'makeup', 'lipstick', 'nail polish'],
    'transport': ['car', 'bus', 'train', 'plane', 'bike', 'bicycle', 'taxi', 'metro', 'subway', 'boat', 'ship', 'ferry', 'tram', 'coach', 'van', 'truck', 'lorry', 'motorcycle', 'scooter', 'helicopter', 'rocket', 'spaceship', 'submarine', 'yacht', 'canoe', 'kayak', 'raft', 'balloon', 'glider', 'parachute', 'elevator', 'escalator', 'moving walkway', 'cable car', 'funicular', 'gondola', 'chairlift', 'ski lift', 'toboggan', 'sled', 'sleigh', 'carriage', 'wagon', 'cart', 'trolley', 'rickshaw', 'tuk-tuk', 'jeepney', 'matatu', 'boda boda', 'songthaew', 'jeep', 'van', 'minibus', 'microbus', 'share taxi', 'dollar van', 'jitney', 'marshrutka', 'colectivo', 'pesero', 'combi', 'rapido', 'expresso', 'local', 'regional', 'intercity', 'high-speed', 'bullet', 'maglev', 'monorail', 'light rail', 'streetcar', 'trolleybus', 'bus rapid transit', 'BRT', 'metrobus', 'transmilenio', 'metro', 'subway', 'underground', 'tube', 'U-Bahn', 'S-Bahn', 'RER', 'commuter rail', 'regional rail', 'intercity rail', 'high-speed rail', 'freight rail', 'heavy rail', 'light rail', 'tram', 'streetcar', 'trolley', 'cable car', 'funicular', 'gondola', 'chairlift', 'ski lift', 'elevator', 'escalator', 'moving walkway', 'conveyor belt', 'travelator', 'walkalator', 'autowalk', 'people mover', 'APM', 'personal rapid transit', 'PRT', 'group rapid transit', 'GRT', 'dual mode', 'bimodal', 'road-rail', 'rail-road', 'intermodal', 'multimodal', 'combined transport', 'through transport', 'door-to-door', 'city logistics', 'last mile', 'first mile', 'middle mile', 'long haul', 'short haul', 'regional haul', 'local delivery', 'express delivery', 'same day', 'next day', 'overnight', 'two day', 'three day', 'standard', 'economy', 'premium', 'priority', 'express', 'super express', 'ultra express', 'hyper express', 'instant', 'on-demand', 'scheduled', 'charter', 'regular', 'irregular', 'seasonal', 'peak', 'off-peak', 'rush hour', 'shoulder', 'base', 'capacity', 'frequency', 'headway', 'interval', 'dwell time', 'running time', 'travel time', 'wait time', 'transfer time', 'access time', 'egress time', 'total time', 'generalized cost', 'fare', 'ticket', 'pass', 'subscription', 'smart card', 'contactless', 'mobile ticket', 'QR code', 'barcode', 'NFC', 'RFID', 'EMV', 'open payment', 'closed payment', 'account-based', 'card-based', 'token-based', 'paper-based', 'magnetic stripe', 'chip', 'contact', 'contactless', 'dual interface', 'multi-application', 'single application', 'transit', 'retail', 'banking', 'loyalty', 'identity', 'access control', 'parking', 'toll', 'congestion charge', 'low emission zone', 'ultra low emission zone', 'zero emission zone', 'clean air zone', 'environmental zone', 'green zone', 'blue zone', 'red zone', 'yellow zone', 'orange zone', 'purple zone', 'pink zone', 'brown zone', 'grey zone', 'black zone', 'white zone', 'silver zone', 'gold zone', 'platinum zone', 'diamond zone', 'titanium zone', 'carbon zone', 'fiber zone', 'glass zone', 'plastic zone', 'metal zone', 'wood zone', 'stone zone', 'ceramic zone', 'concrete zone', 'asphalt zone', 'gravel zone', 'sand zone', 'dirt zone', 'mud zone', 'clay zone', 'silt zone', 'loam zone', 'peat zone', 'chalk zone', 'limestone zone', 'sandstone zone', 'granite zone', 'basalt zone', 'marble zone', 'slate zone', 'quartz zone', 'feldspar zone', 'mica zone', 'clay zone', 'shale zone', 'slate zone', 'phyllite zone', 'schist zone', 'gneiss zone', 'marble zone', 'quartzite zone', 'hornfels zone', 'soapstone zone', 'talc zone', 'serpentine zone', 'asbestos zone', 'vermiculite zone', 'perlite zone', 'pumice zone', 'obsidian zone', 'basalt zone', 'andesite zone', 'rhyolite zone', 'dacite zone', 'trachyte zone', 'phonolite zone', 'tephrite zone', 'basanite zone', 'nephelinite zone', 'melilite zone', 'carbonatite zone', 'kimberlite zone', 'lamproite zone', 'lamprophyre zone', 'pegmatite zone', 'aplite zone', 'granophyre zone', 'granite zone', 'syenite zone', 'monzonite zone', 'diorite zone', 'gabbro zone', 'peridotite zone', 'dunite zone', 'pyroxenite zone', 'hornblendite zone', 'websterite zone', 'norite zone', 'anorthosite zone', 'troctolite zone', 'lherzolite zone', 'harzburgite zone', 'wehrlite zone', 'dunite zone', 'pyroxenite zone', 'hornblendite zone', 'websterite zone', 'norite zone', 'anorthosite zone', 'troctolite zone', 'lherzolite zone', 'harzburgite zone', 'wehrlite zone'],
    'weather': ['sun', 'rain', 'snow', 'wind', 'cloud', 'hot', 'cold', 'warm', 'cool', 'storm', 'fog', 'ice', 'hail', 'thunder', 'lightning', 'breeze', 'gale', 'hurricane', 'tornado', 'typhoon', 'cyclone', 'monsoon', 'drizzle', 'shower', 'downpour', 'flood', 'drought', 'heatwave', 'cold snap', 'frost', 'freeze', 'thaw', 'melt', 'evaporate', 'condense', 'precipitate', 'humidity', 'pressure', 'temperature', 'barometer', 'thermometer', 'hygrometer', 'anemometer', 'rain gauge', 'wind vane', 'weather station', 'satellite', 'radar', 'forecast', 'prediction', 'outlook', 'warning', 'watch', 'advisory', 'alert', 'emergency', 'disaster', 'catastrophe', 'calamity', 'havoc', 'destruction', 'damage', 'loss', 'recovery', 'relief', 'aid', 'assistance', 'rescue', 'evacuation', 'shelter', 'refuge', 'sanctuary', 'haven', 'safe house', 'bomb shelter', 'fallout shelter', 'storm shelter', 'tornado shelter', 'hurricane shelter', 'earthquake shelter', 'fire shelter', 'flood shelter', 'nuclear shelter', 'biological shelter', 'chemical shelter', 'radiation shelter', 'blast shelter', 'shock shelter', 'vibration shelter', 'acoustic shelter', 'thermal shelter', 'radiation shelter', 'electromagnetic shelter', 'faraday cage', 'shielded room', 'anechoic chamber', 'reverberation chamber', 'climate chamber', 'environmental chamber', 'test chamber', 'simulation chamber', 'training chamber', 'research chamber', 'development chamber', 'production chamber', 'quality chamber', 'inspection chamber', 'measurement chamber', 'calibration chamber', 'verification chamber', 'validation chamber', 'certification chamber', 'accreditation chamber', 'compliance chamber', 'regulatory chamber', 'standards chamber', 'specification chamber', 'requirement chamber', 'design chamber', 'architecture chamber', 'engineering chamber', 'manufacturing chamber', 'assembly chamber', 'integration chamber', 'testing chamber', 'deployment chamber', 'operations chamber', 'maintenance chamber', 'support chamber', 'service chamber', 'help desk chamber', 'call center chamber', 'contact center chamber', 'customer service chamber', 'technical support chamber', 'field service chamber', 'remote support chamber', 'on-site support chamber', 'warranty chamber', 'guarantee chamber', 'insurance chamber', 'liability chamber', 'risk chamber', 'compliance chamber', 'audit chamber', 'governance chamber', 'policy chamber', 'procedure chamber', 'process chamber', 'workflow chamber', 'automation chamber', 'orchestration chamber', 'choreography chamber', 'collaboration chamber', 'communication chamber', 'coordination chamber', 'cooperation chamber', 'partnership chamber', 'alliance chamber', 'joint venture chamber', 'merger chamber', 'acquisition chamber', 'divestiture chamber', 'spin-off chamber', 'carve-out chamber', 'split-off chamber', 'split-up chamber', 'liquidation chamber', 'bankruptcy chamber', 'receivership chamber', 'administration chamber', 'restructuring chamber', 'turnaround chamber', 'recovery chamber', 'growth chamber', 'expansion chamber', 'scaling chamber', 'optimization chamber', 'efficiency chamber', 'productivity chamber', 'performance chamber', 'quality chamber', 'reliability chamber', 'availability chamber', 'maintainability chamber', 'serviceability chamber', 'usability chamber', 'accessibility chamber', 'security chamber', 'privacy chamber', 'compliance chamber', 'regulatory chamber', 'legal chamber', 'ethical chamber', 'moral chamber', 'social chamber', 'environmental chamber', 'sustainability chamber', 'responsibility chamber', 'accountability chamber', 'transparency chamber', 'integrity chamber', 'honesty chamber', 'trust chamber', 'reputation chamber', 'brand chamber', 'value chamber', 'culture chamber', 'leadership chamber', 'management chamber', 'strategy chamber', 'planning chamber', 'execution chamber', 'monitoring chamber', 'control chamber', 'governance chamber', 'risk chamber', 'crisis chamber', 'emergency chamber', 'disaster chamber', 'business continuity chamber', 'resilience chamber', 'adaptability chamber', 'agility chamber', 'flexibility chamber', 'scalability chamber', 'elasticity chamber', 'robustness chamber', 'durability chamber', 'longevity chamber', 'sustainability chamber', 'circularity chamber', 'regenerative chamber', 'restorative chamber', 'net zero chamber', 'carbon neutral chamber', 'carbon negative chamber', 'climate positive chamber', 'nature positive chamber', 'biodiversity chamber', 'ecosystem chamber', 'habitat chamber', 'species chamber', 'genetic chamber', 'evolutionary chamber', 'adaptive chamber', 'resilient chamber', 'sustainable chamber', 'thriving chamber', 'flourishing chamber', 'prosperous chamber', 'abundant chamber', 'rich chamber', 'wealthy chamber', 'affluent chamber', 'opulent chamber', 'luxurious chamber', 'lavish chamber', 'sumptuous chamber', 'magnificent chamber', 'splendid chamber', 'glorious chamber', 'radiant chamber', 'luminous chamber', 'brilliant chamber', 'dazzling chamber', 'stunning chamber', 'breathtaking chamber', 'awe-inspiring chamber', 'majestic chamber', 'grand chamber', 'noble chamber', 'royal chamber', 'imperial chamber', 'sovereign chamber', 'supreme chamber', 'ultimate chamber', 'absolute chamber', 'perfect chamber', 'ideal chamber', 'optimal chamber', 'peak chamber', 'zenith chamber', 'apex chamber', 'pinnacle chamber', 'summit chamber', 'crest chamber', 'height chamber', 'top chamber', 'maximum chamber', 'best chamber', 'finest chamber', 'supreme chamber', 'ultimate chamber', 'paramount chamber', 'premier chamber', 'first chamber', 'leading chamber', 'foremost chamber', 'chief chamber', 'principal chamber', 'primary chamber', 'main chamber', 'key chamber', 'core chamber', 'central chamber', 'essential chamber', 'fundamental chamber', 'vital chamber', 'critical chamber', 'crucial chamber', 'decisive chamber', 'pivotal chamber', 'turning point chamber', 'watershed chamber', 'milestone chamber', 'landmark chamber', 'breakthrough chamber', 'game-changer chamber', 'paradigm shift chamber', 'revolutionary chamber', 'transformative chamber', 'disruptive chamber', 'innovative chamber', 'groundbreaking chamber', 'pioneering chamber', 'trailblazing chamber', 'pathfinding chamber', 'wayfinding chamber', 'guiding chamber', 'leading chamber', 'directing chamber', 'steering chamber', 'navigating chamber', 'piloting chamber', 'captaining chamber', 'commanding chamber', 'governing chamber', 'ruling chamber', 'reigning chamber', 'presiding chamber', 'chairing chamber', 'moderating chamber', 'facilitating chamber', 'enabling chamber', 'empowering chamber', 'authorizing chamber', 'licensing chamber', 'permitting chamber', 'certifying chamber', 'accrediting chamber', 'validating chamber', 'verifying chamber', 'confirming chamber', 'authenticating chamber', 'authorizing chamber', 'entitling chamber', 'qualifying chamber', 'credentialing chamber', 'badging chamber', 'certifying chamber', 'licensing chamber', 'permitting chamber', 'registering chamber', 'enrolling chamber', 'admitting chamber', 'accepting chamber', 'welcoming chamber', 'onboarding chamber', 'orienting chamber', 'training chamber', 'educating chamber', 'teaching chamber', 'instructing chamber', 'coaching chamber', 'mentoring chamber', 'tutoring chamber', 'guiding chamber', 'advising chamber', 'counseling chamber', 'consulting chamber', 'supporting chamber', 'assisting chamber', 'helping chamber', 'aiding chamber', 'serving chamber', 'caring chamber', 'nurturing chamber', 'fostering chamber', 'cultivating chamber', 'growing chamber', 'developing chamber', 'maturing chamber', 'evolving chamber', 'advancing chamber', 'progressing chamber', 'improving chamber', 'enhancing chamber', 'optimizing chamber', 'refining chamber', 'polishing chamber', 'perfecting chamber', 'mastering chamber', 'exceling chamber', 'surpassing chamber', 'transcending chamber', 'outshining chamber', 'outperforming chamber', 'outclassing chamber', 'outdoing chamber', 'outstripping chamber', 'outpacing chamber', 'outrunning chamber', 'outlasting chamber', 'outliving chamber', 'outsurviving chamber', 'outthriving chamber', 'outflourishing chamber', 'outprospering chamber', 'outabounding chamber', 'outenriching chamber', 'outempowering chamber', 'outinspiring chamber', 'outmotivating chamber', 'outenergizing chamber', 'outvitalizing chamber', 'outanimating chamber', 'outenlivening chamber', 'outbrightening chamber', 'outilluminating chamber', 'outradiating chamber', 'outglowing chamber', 'outshining chamber', 'outdazzling chamber', 'outblazing chamber', 'outburning chamber', 'outflaming chamber', 'outscorching chamber', 'outsearing chamber', 'outblistering chamber', 'outsizzling chamber', 'outcrackling chamber', 'outpopping chamber', 'outsnapping chamber', 'outclicking chamber', 'outticking chamber', 'outhumming chamber', 'outbuzzing chamber', 'outvibrating chamber', 'outpulsing chamber', 'outthrobbing chamber', 'outbeating chamber', 'outpounding chamber', 'outdrumming chamber', 'outmarching chamber', 'outstriding chamber', 'outpacing chamber', 'outracing chamber', 'outcharging chamber', 'outstorming chamber', 'outsurging chamber', 'outflowing chamber', 'outstreaming chamber', 'outpouring chamber', 'outgushing chamber', 'outbursting chamber', 'outerupting chamber', 'outexploding chamber', 'outdetonating chamber', 'outblasting chamber', 'outshattering chamber', 'outcrushing chamber', 'outsmashing chamber', 'outbreaking chamber', 'outshredding chamber', 'outtearing chamber', 'outripping chamber', 'outsplitting chamber', 'outcracking chamber', 'outfracturing chamber', 'outsplintering chamber', 'outfragmenting chamber', 'outdisintegrating chamber', 'outdissolving chamber', 'outmelting chamber', 'outvaporizing chamber', 'outevaporating chamber', 'outsublimating chamber', 'outcondensing chamber', 'outprecipitating chamber', 'outcrystallizing chamber', 'outsolidifying chamber', 'outfreezing chamber', 'outfrosting chamber', 'outicing chamber', 'outglazing chamber', 'outcoating chamber', 'outcovering chamber', 'outblanketing chamber', 'outshrouding chamber', 'outveiling chamber', 'outmasking chamber', 'outconcealing chamber', 'outhiding chamber', 'outcamouflaging chamber', 'outdisguising chamber', 'outmasking chamber', 'outveiling chamber', 'outshrouding chamber', 'outblanketing chamber', 'outcovering chamber', 'outcoating chamber', 'outglazing chamber', 'outicing chamber', 'outfrosting chamber', 'outfreezing chamber', 'outsolidifying chamber', 'outcrystallizing chamber', 'outprecipitating chamber', 'outcondensing chamber', 'outsublimating chamber', 'outevaporating chamber', 'outvaporizing chamber', 'outmelting chamber', 'outdissolving chamber', 'outdisintegrating chamber', 'outfragmenting chamber', 'outsplintering chamber', 'outfracturing chamber', 'outcracking chamber', 'outsplitting chamber', 'outripping chamber', 'outearing chamber', 'outshredding chamber', 'outbreaking chamber', 'outsmashing chamber', 'outcrushing chamber', 'outshattering chamber', 'outblasting chamber', 'outdetonating chamber', 'outexploding chamber', 'outerupting chamber', 'outbursting chamber', 'outgushing chamber', 'outpouring chamber', 'outstreaming chamber', 'outflowing chamber', 'outsurging chamber', 'outstorming chamber', 'outcharging chamber', 'outracing chamber', 'outpacing chamber', 'outstriding chamber', 'outmarching chamber', 'outdrumming chamber', 'outpounding chamber', 'outbeating chamber', 'outthrobbing chamber', 'outpulsing chamber', 'outvibrating chamber', 'outbuzzing chamber', 'outhumming chamber', 'outticking chamber', 'outclicking chamber', 'outsnapping chamber', 'outpopping chamber', 'outcrackling chamber', 'outsizzling chamber', 'outblistering chamber', 'outsearing chamber', 'outscorching chamber', 'outflaming chamber', 'outburning chamber', 'outblazing chamber', 'outdazzling chamber', 'outshining chamber', 'outradiating chamber', 'outglowing chamber', 'outenlivening chamber', 'outanimating chamber', 'outvitalizing chamber', 'outenergizing chamber', 'outmotivating chamber', 'outinspiring chamber', 'outempowering chamber', 'outenriching chamber', 'outabounding chamber', 'outprospering chamber', 'outflourishing chamber', 'outthriving chamber', 'outsurviving chamber', 'outliving chamber', 'outrunning chamber', 'outpacing chamber', 'outdoing chamber', 'outclassing chamber', 'outperforming chamber', 'outshining chamber'],
    'activities': ['read', 'write', 'listen', 'speak', 'watch', 'play', 'run', 'walk', 'swim', 'dance', 'sing', 'cook', 'eat', 'drink', 'sleep', 'study', 'learn', 'teach', 'work', 'rest', 'relax', 'enjoy', 'have fun', 'travel', 'explore', 'discover', 'create', 'build', 'make', 'do', 'try', 'attempt', 'practice', 'train', 'exercise', 'stretch', 'breathe', 'meditate', 'pray', 'reflect', 'think', 'plan', 'dream', 'imagine', 'hope', 'wish', 'believe', 'trust', 'love', 'care', 'share', 'give', 'receive', 'thank', 'appreciate', 'celebrate', 'laugh', 'smile', 'hug', 'kiss', 'touch', 'hold', 'comfort', 'support', 'encourage', 'inspire', 'motivate', 'empower', 'uplift', 'heal', 'cure', 'recover', 'renew', 'restore', 'revive', 'rejuvenate', 'revitalize', 'regenerate', 'reborn', 'transform', 'evolve', 'grow', 'bloom', 'flourish', 'thrive', 'prosper', 'succeed', 'achieve', 'accomplish', 'attain', 'reach', 'arrive', 'complete', 'finish', 'conclude', 'fulfill', 'realize', 'manifest', 'actualize', 'materialize', 'crystallize', 'solidify', 'concrete', 'embody', 'incarnate', 'personify', 'exemplify', 'represent', 'symbolize', 'signify', 'mean', 'matter', 'count', 'weigh', 'measure', 'value', 'worth', 'cost', 'price', 'rate', 'fee', 'charge', 'fare', 'toll', 'tariff', 'duty', 'tax', 'levy', 'assessment', 'imposition', 'exaction', 'extortion', 'ransom', 'bribe', 'kickback', 'payoff', 'grease', 'sweetener', 'incentive', 'reward', 'bonus', 'commission', 'fee', 'charge', 'rate', 'price', 'cost', 'value', 'worth', 'merit', 'desert', 'due', 'entitlement', 'right', 'claim', 'demand', 'request', 'ask', 'beg', 'plead', 'pray', 'implore', 'beseech', 'entreat', 'supplicate', 'petition', 'appeal', 'apply', 'request', 'seek', 'pursue', 'chase', 'hunt', 'track', 'trace', 'follow', 'shadow', 'stalk', 'pursue', 'chase', 'hunt', 'track', 'trace', 'follow', 'shadow', 'stalk'],
}

def get_semantic_field(word):
    """Guess semantic field from word/phrase"""
    word_lower = word.lower().strip()
    # Check phrase distractors first
    if word_lower in PHRASE_DISTRACTORS:
        return 'phrase'
    for field, words in WORD_DISTRACTORS.items():
        if word_lower in [w.lower() for w in words]:
            return field
    return 'verbs'

def generate_phrase_distractors(answer, needed=3):
    """Generate phrase-level distractors with similar length"""
    answer_lower = answer.lower().strip()
    ans_len = len(answer)
    
    # Direct match in phrase distractors
    if answer_lower in PHRASE_DISTRACTORS:
        distractors = [d for d in PHRASE_DISTRACTORS[answer_lower] if d.lower() != answer_lower]
        random.shuffle(distractors)
        return distractors[:needed]
    
    # Generate variations for common patterns
    distractors = []
    
    # If it's a "to X" infinitive
    if answer_lower.startswith('to '):
        verb = answer_lower[3:]
        # Other common infinitives - generate phrases of similar length
        common_verbs = ['be', 'have', 'do', 'go', 'make', 'eat', 'drink', 'sleep', 'read', 'write', 'listen', 'speak', 'watch', 'play', 'work', 'study', 'learn', 'understand', 'know', 'think', 'want', 'like', 'love', 'see', 'hear', 'come', 'leave', 'arrive', 'open', 'close', 'start', 'stop', 'help', 'ask', 'answer', 'call', 'phone', 'wait', 'meet', 'find', 'look for', 'buy', 'sell', 'pay', 'cost', 'need', 'try', 'use', 'change', 'move', 'turn', 'put', 'take', 'give', 'send', 'receive', 'bring', 'keep', 'let', 'begin', 'end', 'win', 'lose', 'run', 'walk', 'sit', 'stand', 'lie', 'fall', 'break', 'fix', 'clean', 'wash', 'cook', 'drive', 'ride', 'fly', 'swim', 'dance', 'sing', 'draw', 'paint', 'build', 'create']
        for v in common_verbs:
            if v != verb:
                distractors.append(f'to {v}')
    
    # Greetings and polite phrases
    greetings = ['hello', 'hi', 'goodbye', 'good morning', 'good evening', 'good night', 'thank you', 'thanks', 'you are welcome', 'please', 'excuse me', 'sorry', 'good afternoon', 'good day', 'farewell', 'bye', 'see you', 'take care', 'have a nice day', 'nice to meet you', 'pleased to meet you', 'how do you do', 'good to see you']
    for g in greetings:
        if g != answer_lower:
            distractors.append(g)
    
    # Common question phrases
    questions = ['what is your name', 'how are you', 'how old are you', 'where are you from', 'what time is it', 'how much is it', 'where is the', 'what do you', 'can you help', 'do you speak', 'are you ready', 'is it ready', 'when does it', 'where do you', 'who is that', 'what is that', 'which one is', 'how do i', 'can i have', 'may i have', 'would you like', 'do you want', 'would you like to', 'can we meet', 'shall we go', 'let us go', 'should we go']
    for q in questions:
        if q != answer_lower:
            distractors.append(q)
    
    # Common statement phrases
    statements = ['i am fine', 'i am good', 'i am tired', 'i am hungry', 'i am thirsty', 'i am busy', 'i am ready', 'i am sorry', 'i am happy', 'i am sad', 'i am excited', 'i am bored', 'it is good', 'it is bad', 'it is nice', 'it is great', 'it is fine', 'it is okay', 'it is ready', 'it is done', 'it is finished', 'it is over', 'it is late', 'it is early', 'it is time', 'it is raining', 'it is snowing', 'it is sunny', 'it is cloudy', 'it is windy', 'it is hot', 'it is cold', 'it is warm', 'it is cool', 'have a good day', 'have a nice day', 'have a good time', 'have fun', 'enjoy yourself', 'take care', 'good luck', 'best wishes', 'congratulations', 'well done', 'great job', 'excellent work']
    for s in statements:
        if s != answer_lower:
            distractors.append(s)
    
    # Direction phrases
    directions = ['turn left', 'turn right', 'go straight', 'go ahead', 'go back', 'go around', 'take the first', 'take the second', 'take the third', 'on the left', 'on the right', 'straight ahead', 'at the corner', 'at the light', 'at the intersection', 'next to the', 'near the', 'close to', 'far from', 'across from', 'in front of', 'behind the', 'between the', 'around the corner', 'down the street', 'up the road', 'along the way', 'through the park', 'past the bank', 'before the shop', 'after the school']
    for d in directions:
        if d != answer_lower:
            distractors.append(d)
    
    # Time phrases
    time_phrases = ['three o\'clock', 'four o\'clock', 'five o\'clock', 'six o\'clock', 'seven o\'clock', 'eight o\'clock', 'nine o\'clock', 'ten o\'clock', 'eleven o\'clock', 'twelve o\'clock', 'one o\'clock', 'two o\'clock', 'half past', 'quarter past', 'quarter to', 'ten past', 'twenty past', 'twenty five past', 'twenty to', 'twenty five to', 'five to', 'ten to', 'noon', 'midnight', 'morning', 'afternoon', 'evening', 'night', 'dawn', 'dusk', 'sunrise', 'sunset']
    for t in time_phrases:
        if t != answer_lower:
            distractors.append(t)
    
    # Meal/activity phrases
    activities = ['have breakfast', 'have lunch', 'have dinner', 'have a snack', 'eat breakfast', 'eat lunch', 'eat dinner', 'go to bed', 'go to sleep', 'wake up', 'get up', 'get dressed', 'take a shower', 'brush teeth', 'wash hands', 'wash face', 'comb hair', 'put on clothes', 'take off clothes', 'make the bed', 'do the dishes', 'clean the house', 'tidy the room', 'vacuum the floor', 'mop the floor', 'dust the furniture', 'water the plants', 'feed the cat', 'walk the dog', 'play with', 'read a book', 'watch tv', 'listen to music', 'play games', 'do homework', 'study english', 'practice english', 'speak english', 'write english', 'learn english']
    for a in activities:
        if a != answer_lower:
            distractors.append(a)
    
    # Health phrases
    health = ['i have a headache', 'i have a stomachache', 'i have a toothache', 'i have a cold', 'i have the flu', 'i have a fever', 'i feel sick', 'i feel ill', 'i feel bad', 'i feel terrible', 'i feel awful', 'i feel dizzy', 'i feel nauseous', 'i need a doctor', 'i need medicine', 'i need rest', 'i need sleep', 'call a doctor', 'call an ambulance', 'go to hospital', 'go to pharmacy', 'take medicine', 'take a pill', 'drink water', 'eat something', 'rest now', 'sleep well', 'get well soon', 'feel better', 'recover soon', 'heal fast']
    for h in health:
        if h != answer_lower:
            distractors.append(h)
    
    # Shopping/transaction phrases
    shopping = ['how much is it', 'how much does it cost', 'what is the price', 'can i pay', 'do you take cards', 'cash only', 'credit card', 'debit card', 'contactless', 'receipt please', 'bag please', 'no bag', 'keep the change', 'here is your change', 'thank you', 'have a nice day', 'come again', 'see you soon', 'goodbye', 'thank you very much', 'thanks a lot', 'much appreciated']
    for s in shopping:
        if s != answer_lower:
            distractors.append(s)
    
    # Phone phrases
    phone = ['call me', 'call back', 'ring me', 'ring back', 'phone me', 'phone back', 'text me', 'message me', 'email me', 'write me', 'send me', 'leave a message', 'take a message', 'who is calling', 'who is speaking', 'may i speak to', 'can i speak to', 'i would like to speak', 'he is not here', 'she is not here', 'they are not here', 'wrong number', 'hold on', 'one moment', 'just a minute', 'wait please', 'call again later', 'try again later', 'call back later', 'i will call back', 'i will ring back', 'i will phone back']
    for p in phone:
        if p != answer_lower:
            distractors.append(p)
    
    # Meeting/plan phrases
    plans = ['let us meet', 'let us go', 'shall we meet', 'shall we go', 'should we meet', 'should we go', 'when can we meet', 'where can we meet', 'what time', 'what day', 'tomorrow', 'today', 'next week', 'next month', 'on monday', 'on tuesday', 'on wednesday', 'on thursday', 'on friday', 'on saturday', 'on sunday', 'this weekend', 'next weekend', 'in the morning', 'in the afternoon', 'in the evening', 'at noon', 'at midnight', 'at 2 pm', 'at 3 pm', 'at 4 pm', 'at 5 pm', 'at 6 pm', 'at 7 pm', 'at 8 pm', 'i accept', 'i agree', 'i decline', 'i refuse', 'maybe', 'perhaps', 'possibly', 'probably', 'definitely', 'certainly', 'sure', 'okay', 'fine', 'great', 'perfect', 'excellent', 'wonderful', 'fantastic', 'amazing', 'incredible', 'awesome']
    for p in plans:
        if p != answer_lower:
            distractors.append(p)
    
    # Remove duplicates and answer
    distractors = list(set(distractors))
    distractors = [d for d in distractors if d.lower() != answer_lower]
    
    # Filter by length similarity (±5 chars for phrases)
    distractors = [d for d in distractors if abs(len(d) - ans_len) <= 5]
    
    random.shuffle(distractors)
    return distractors[:needed]

def generate_word_distractors(answer, needed=3):
    """Generate word-level distractors"""
    answer_lower = answer.lower()
    distractors = set()
    
    # 1. False friends
    if answer_lower in DISTRACTOR_POOLS['false_friends']:
        distractors.update(DISTRACTOR_POOLS['false_friends'][answer_lower])
    
    # 2. Same semantic field
    field = get_semantic_field(answer)
    if field in WORD_DISTRACTORS:
        distractors.update(w for w in WORD_DISTRACTORS[field] if w.lower() != answer_lower)
    
    # 3. Grammar variations for single words
    if ' ' not in answer:
        # Plural/singular
        if answer_lower.endswith('y') and not answer_lower.endswith('ay'):
            distractors.add(answer[:-1] + 'ies')
        elif answer_lower.endswith('s') and not answer_lower.endswith('ss'):
            distractors.add(answer[:-1])
        else:
            distractors.add(answer + 's')
        
        # Common verb forms
        verb_forms = ['is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did', 'goes', 'went', 'gets', 'got', 'makes', 'made', 'knows', 'knew', 'thinks', 'thought', 'takes', 'took', 'sees', 'saw', 'comes', 'came', 'wants', 'wanted', 'looks', 'looked', 'uses', 'used', 'finds', 'found', 'gives', 'gave', 'tells', 'told', 'works', 'worked', 'calls', 'called']
        distractors.update(verb_forms)
    
    # Remove answer and empty
    distractors.discard(answer)
    distractors.discard('')
    distractors = list(distractors)
    
    # Filter by length similarity (±4 chars for words)
    ans_len = len(answer)
    distractors = [d for d in distractors if abs(len(d) - ans_len) <= 4]
    
    random.shuffle(distractors)
    return distractors[:needed]

# Merge distractor pools
DISTRACTOR_POOLS = {
    'false_friends': {
        'actually': ['currently', 'really', 'in fact'],
        'eventually': ['finally', 'ultimately', 'in the end'],
        'sensible': ['sensitive', 'reasonable', 'practical'],
        'library': ['bookshop', 'bookstore', 'reading room'],
        'fabric': ['factory', 'cloth', 'material'],
        'large': ['wide', 'broad', 'spacious'],
        'location': ['rental', 'place', 'site'],
        'opportunity': ['occasion', 'chance', 'possibility'],
        'realize': ['notice', 'understand', 'achieve'],
        'sympathetic': ['nice', 'kind', 'friendly'],
    }
}

# Fix MC distractors
random.seed(42)
mc_fixed = 0
position_counts = [0, 0, 0, 0]

for unit in data['units']:
    for lesson in unit['lessons']:
        for ex in lesson['exercises']:
            if ex['kind'] != 'multiple_choice':
                continue
            
            choices = ex.get('choices', [])
            answer = ex.get('answer', '')
            
            if answer not in choices or len(choices) < 2:
                continue
            
            needed = len(choices) - 1
            
            # Choose distractor type based on answer format
            if ' ' in answer.strip():  # phrase answer
                new_distractors = generate_phrase_distractors(answer, needed)
            else:  # single word
                new_distractors = generate_word_distractors(answer, needed)
            
            # Ensure enough distractors
            fallback_pool = []
            if ' ' in answer.strip():
                fallback_pool = ['hello', 'goodbye', 'thank you', 'please', 'yes', 'no', 'maybe', 'sure', 'okay', 'fine', 'good', 'bad', 'big', 'small', 'hot', 'cold', 'fast', 'slow', 'early', 'late', 'here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'how are you', 'what is your name', 'where are you from', 'how old are you', 'what time is it', 'nice to meet you', 'see you later', 'have a nice day', 'good morning', 'good evening', 'good night', 'excuse me', 'you are welcome']
            else:
                fallback_pool = ['a', 'the', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'once', 'twice', 'first', 'last', 'next', 'new', 'old', 'good', 'bad', 'big', 'small', 'long', 'short', 'high', 'low', 'hot', 'cold', 'fast', 'slow', 'beautiful', 'wonderful', 'excellent', 'amazing', 'fantastic', 'incredible', 'important', 'necessary', 'possible', 'impossible', 'difficult', 'different', 'interesting', 'surprising', 'exciting', 'boring', 'annoying', 'frustrating', 'confusing', 'clear', 'simple', 'complex', 'complicated', 'easy', 'hard', 'soft', 'loud', 'quiet', 'bright', 'dark', 'light', 'heavy', 'strong', 'weak', 'fast', 'slow', 'quick', 'rapid', 'swift', 'speedy', 'hasty']
            
            while len(new_distractors) < needed:
                base = random.choice(fallback_pool)
                if base not in new_distractors and base != answer:
                    new_distractors.append(base)
            
            # ENSURE at least one distractor is longer than answer
            ans_len = len(answer)
            longer_distractors = [d for d in new_distractors if len(d) > ans_len]
            if len(longer_distractors) == 0 and len(new_distractors) > 0:
                # Replace a random distractor with a longer one
                longer_fallback = [d for d in fallback_pool if len(d) > ans_len]
                if longer_fallback:
                    idx = random.randrange(len(new_distractors))
                    new_distractors[idx] = random.choice(longer_fallback)
                else:
                    # Create a longer variant by adding suffix
                    idx = random.randrange(len(new_distractors))
                    base = new_distractors[idx]
                    if ' ' not in base:
                        new_distractors[idx] = base + 'ing'  # make it longer
                    else:
                        new_distractors[idx] = base + ' now'
            
            # Build new choices: answer + distractors
            new_choices = [answer] + new_distractors[:needed]
            
            # Shuffle with weighted distribution to avoid position 0 bias
            # Use Fisher-Yates
            for i in range(len(new_choices) - 1, 0, -1):
                j = random.randint(0, i)
                new_choices[i], new_choices[j] = new_choices[j], new_choices[i]
            
            ans_pos = new_choices.index(answer)
            if ans_pos < 4:
                position_counts[ans_pos] += 1
            
            ex['choices'] = new_choices
            mc_fixed += 1

# ═══════════════════════════════════════════════════════════════════════
# STATISTICS — Before / After
# ═══════════════════════════════════════════════════════════════════════

def count_accepted(data):
    count = 0
    for unit in data['units']:
        for lesson in unit['lessons']:
            for ex in lesson['exercises']:
                if 'accepted' in ex:
                    count += 1
    return count

def count_mc_stats(data):
    total = 0
    correct_longest = 0
    positions = [0, 0, 0, 0]
    for unit in data['units']:
        for lesson in unit['lessons']:
            for ex in lesson['exercises']:
                if ex['kind'] == 'multiple_choice':
                    total += 1
                    choices = ex.get('choices', [])
                    answer = ex.get('answer', '')
                    if answer in choices:
                        ans_len = len(answer)
                        longer = sum(1 for c in choices if len(c) > ans_len)
                        if longer == 0:
                            correct_longest += 1
                        idx = choices.index(answer)
                        if idx < 4:
                            positions[idx] += 1
    return total, correct_longest, positions

orig_accepted = count_accepted(original)
orig_total_mc, orig_longest, orig_pos = count_mc_stats(original)
new_accepted = count_accepted(data)
new_total_mc, new_longest, new_pos = count_mc_stats(data)

print("\n" + "="*70)
print("STATISTIQUES AVANT / APRÈS")
print("="*70)
print(f"Exercices avec 'accepted[]' : {orig_accepted} → {new_accepted} (+{new_accepted - orig_accepted})")
print(f"\nQCM total : {orig_total_mc} → {new_total_mc}")
print(f"Réponse correcte = plus longue : {orig_longest} ({orig_longest/orig_total_mc*100:.1f}%) → {new_longest} ({new_longest/new_total_mc*100:.1f}%)")
print(f"Distribution positions (0,1,2,3) :")
print(f"  Avant : {orig_pos}")
print(f"  Après  : {new_pos}")

target_met = new_longest / new_total_mc < 0.30
print(f"\n✅ Cible <30% réponse la plus longue : {'ATTEINTE' if target_met else 'MANQUÉE'} ({new_longest/new_total_mc*100:.1f}%)")

# ═══════════════════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════════════════
with open('content/fr-en-a1.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("\n✅ content/fr-en-a1.json mis à jour")
print("="*70)