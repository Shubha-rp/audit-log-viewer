
export const CATEGORIES = [
  "audit.security-events",
  "audit.configuration",
  "audit.data-access",
  "audit.data-modification",
];


export function parseJson(value) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseNested(value) {
  let parsed = value;

  // Some audit records contain JSON encoded as a string
  // inside another JSON string.
  for (let i = 0; i < 3 && typeof parsed === "string"; i++) {
    const next = parseJson(parsed);
    if (next === parsed) break;
    parsed = next;
  }

  return parsed;
}

export function getDetails(record) {
  const details = parseNested(record?.message);

  if (!details || typeof details !== "object") {
    return {};
  }

  // Preserve the nested data while making its fields accessible.
  const data = parseNested(details.data);

  return {
    ...details,
    ...(data && typeof data === "object" ? { parsedData: data } : {}),
  };
}

export function normalizeRecord(record, index = 0) {
  const details = getDetails(record);
  const data = details.parsedData || {};

  const attributes = Array.isArray(details.attributes)
    ? details.attributes
    : Array.isArray(data.attributes)
      ? data.attributes
      : [];

  const object = details.object || data.object || {};
  const objectId = object.id || {};

  return {
    id: record.message_uuid || record.id || details.uuid || index,
    time: record.time || details.time || "",
    category: record.category || details.category || "Unknown",
    actor: record.user || details.user || data.user || "—",
    ip: details.ip || data.ip || "—",
    event:
      details.message ||
      data.message ||
      object.type ||
      objectId.crudType ||
      "Audit event",
    operation:
      objectId.crudType ||
      objectId.operationType ||
      object.type ||
      "—",
    entity:
      objectId.object_id ||
      objectId.entity ||
      objectId.id ||
      "—",
    success: details.success ?? data.success ?? null,
    attributes,
    details,
    raw: record,
  };
}


export function getCategoryLabel(category) {
  const labels = {
    "audit.security-events": "Security Events",
    "audit.configuration": "Configuration",
    "audit.data-access": "Data Access",
    "audit.data-modification": "Data Modification",
  };

  return labels[category] || category || "Unknown";
}

export function getCategoryFields(record) {
  const category = record.category;
  const details = record.details || {};
  const object = details.object || {};
  const objectId = object.id || {};
  const attributes = details.attributes || [];

  if (category === "audit.security-events") {
    return [
      ["Event", record.event],
      ["Actor", record.actor],
      ["IP address", record.ip],
      ["Level", details.level || details.parsedData?.level || "—"],
      ["Correlation ID", details.correlationId || "—"],
    ];
  }

  if (category === "audit.configuration") {
    return [
      ["Operation", objectId.operationType || objectId.crudType || "—"],
      ["Entity type", object.type || "—"],
      ["Entity / object", objectId.object_id || objectId.id || "—"],
      ["Actor", record.actor],
      ["Status", details.status || "—"],
      ["Attributes", attributes.length],
    ];
  }

  if (category === "audit.data-access") {
    return [
      ["Event", record.event],
      ["Actor", record.actor],
      ["Resource", objectId.object_id || objectId.id || "—"],
      ["Entity type", object.type || "—"],
      ["IP address", record.ip],
    ];
  }

  if (category === "audit.data-modification") {
    return [
      ["Operation", objectId.crudType || objectId.operationType || "—"],
      ["Entity type", object.type || "—"],
      ["Entity", objectId.object_id || objectId.id || "—"],
      ["Actor", record.actor],
      ["Success", details.success ?? details.status ?? "—"],
      ["Changed attributes", attributes.length],
    ];
  }

  return [
    ["Event", record.event],
    ["Actor", record.actor],
  ];
}

export function matchesSearch(record, query) {
  if (!query.trim()) return true;

  const haystack = [
    record.id,
    record.time,
    record.category,
    record.actor,
    record.ip,
    record.event,
    JSON.stringify(record.details),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
}
