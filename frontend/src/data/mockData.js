/**
 * SafeGuard AI - Domain Data & Constants
 * PPE Detection, Hardware Specifications & Industrial Safety Benchmarks
 */

export const FAQ_ITEMS = [
  {
    q: "How does SafeGuard AI verify PPE compliance in real time?",
    a: "SafeGuard AI runs an edge-optimized YOLOv8 deep learning neural network on live video frames captured at site access points. It detects and spatially correlates required safety gear—such as Hard Hats (EN 397 / ANSI Z89.1), High-Visibility Vests (EN ISO 20471), Face Masks, Safety Gloves, and Steel-Toe Boots—in under 40 milliseconds before signaling the barrier gate."
  },
  {
    q: "How does the barrier gate and hardware automation respond?",
    a: "When all mandatory safety items are verified above the confidence threshold, the gateway actuates a motorized servo turnstile barrier to 90° (Open) for a configurable duration (default 5s) and illuminates a green LED beacon. If any required gear is missing, the gate remains locked, the red LED and audible alert buzzer trigger, and the LCD displays which item is missing."
  },
  {
    q: "Can the mandatory PPE requirements be customized per work zone?",
    a: "Yes. Site safety officers can dynamically adjust mandatory checklist requirements (e.g. require mask or gloves for chemical/confined spaces, or just helmet + vest for general construction) and fine-tune inference confidence thresholds directly from the Safety Settings panel in real time without restarting the server."
  },
  {
    q: "What happens if a worker tries to pass with missing safety gear?",
    a: "The system immediately flags a non-compliance event, captures a high-resolution snapshot with bounding box annotations, records a persistent audit entry in the SQLite ledger, and sounds the warning buzzer while displaying specific guidance on the 16x2 character display (e.g., 'MISSING: HELMET')."
  },
  {
    q: "Does SafeGuard AI work offline or on edge hardware like Raspberry Pi?",
    a: "Yes. The AI vision engine runs locally via ONNX Runtime with zero cloud dependency required for gate actuation. It can be deployed on a Raspberry Pi 4 with physical GPIO servo, LEDs, buzzer, and I2C LCD, or on any workstation with automatic Digital Twin hardware simulation."
  },
  {
    q: "How does the single-user access control authentication work?",
    a: "SafeGuard AI enforces role-gated access where the designated Safety Controller / Gate Administrator authenticates using email credentials, Firebase OAuth, or instant 1-click test credentials to oversee live gate feeds, manage staff permits, and configure gate safety thresholds."
  }
];

export const BENCHMARK_SCENARIOS = [
  {
    id: "full_compliant",
    name: "Full PPE Compliant Worker",
    description: "Hard Hat + High-Vis Vest + Face Mask + Work Gloves + Safety Boots",
    expected: "GRANTED",
    missing: [],
    badgeClass: "badge-success",
    image: "/api/benchmarks/image/full_compliant.jpg"
  },
  {
    id: "missing_helmet",
    name: "Missing Safety Hard Hat",
    description: "Worker has vest, mask, gloves and boots, but lacks head protection",
    expected: "DENIED",
    missing: ["helmet"],
    badgeClass: "badge-danger",
    image: "/api/benchmarks/image/missing_helmet.jpg"
  },
  {
    id: "missing_vest",
    name: "Missing High-Vis Vest",
    description: "Worker wearing plain dark shirt without high-visibility reflective vest",
    expected: "DENIED",
    missing: ["vest"],
    badgeClass: "badge-danger",
    image: "/api/benchmarks/image/missing_vest.jpg"
  },
  {
    id: "missing_mask",
    name: "Missing Protective Face Mask",
    description: "Worker with helmet, vest, gloves and boots, but unmasked mouth/nose",
    expected: "DENIED",
    missing: ["mask"],
    badgeClass: "badge-warning",
    image: "/api/benchmarks/image/missing_mask.jpg"
  },
  {
    id: "missing_gloves",
    name: "Missing Cut-Resistant Gloves",
    description: "Worker has bare hands without EN 388 rated safety work gloves",
    expected: "DENIED",
    missing: ["gloves"],
    badgeClass: "badge-warning",
    image: "/api/benchmarks/image/missing_gloves.jpg"
  },
  {
    id: "missing_shoes",
    name: "Non-Compliant Footwear",
    description: "Worker wearing casual sneakers without steel-toe safety boots",
    expected: "DENIED",
    missing: ["shoes"],
    badgeClass: "badge-danger",
    image: "/api/benchmarks/image/missing_shoes.jpg"
  }
];

export const PPE_ITEMS_CATALOG = [
  { id: "helmet", label: "Hard Hat / Helmet", icon: "HardHat", standard: "EN 397 / ANSI Z89.1", defaultReq: true },
  { id: "vest", label: "High-Visibility Vest", icon: "Shirt", standard: "EN ISO 20471 Class 2", defaultReq: true },
  { id: "mask", label: "Protective Mask", icon: "Shield", standard: "EN 149 FFP2 / N95", defaultReq: false },
  { id: "gloves", label: "Work Gloves", icon: "Hand", standard: "EN 388 Cut Resistant", defaultReq: false },
  { id: "shoes", label: "Steel-Toe Boots", icon: "Footprints", standard: "EN ISO 20345 S3", defaultReq: false }
];
