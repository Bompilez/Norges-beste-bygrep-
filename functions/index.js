const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 20 });

const contactEncryptionKey = defineSecret("CONTACT_ENCRYPTION_KEY");
const rateLimitSecret = defineSecret("RATE_LIMIT_SECRET");
const db = admin.firestore();

const campaignCities = [
  "Oslo",
  "Trondheim",
  "Fredrikstad og Sarpsborg",
  "Drammen",
  "Kristiansand",
  "Sandnes og Stavanger",
  "Skien og Porsgrunn",
  "Bergen",
  "Tromsø"
];

const superAdminEmails = [
  "bjornar@eggedosis.no",
  "emilie.nordstrom@gknordic.com",
  "en@kime.no"
];
const dailySubmissionLimit = 10;

exports.submitVote = onCall({
  secrets: [contactEncryptionKey, rateLimitSecret],
  invoker: "public",
  enforceAppCheck: true
}, async (request) => {
  const form = normalizeVoteInput(request.data || {});
  const clientContext = getClientContext(request);
  const createdAt = admin.firestore.FieldValue.serverTimestamp();
  const voteRef = db.collection("votes").doc();
  const rateLimitKey = buildRateLimitKey(clientContext, rateLimitSecret.value());
  const rateLimitRef = db.collection("submissionRateLimits").doc(rateLimitKey);
  const voteData = {
    city: form.city,
    cityConcept: form.cityConcept,
    cityConceptReason: form.cityConceptReason,
    wantsGiveaway: form.wantsGiveaway,
    giveawayEntryId: form.wantsGiveaway ? voteRef.id : "",
    nameEntryKey: "",
    emailEntryKey: "",
    rateLimitKey,
    consentGiven: form.wantsGiveaway,
    createdAt
  };

  await db.runTransaction(async (transaction) => {
    const rateLimitSnapshot = await transaction.get(rateLimitRef);
    const dailySubmissionCount = rateLimitSnapshot.exists
      ? Number(rateLimitSnapshot.data()?.count || 0)
      : 0;

    if (dailySubmissionCount >= dailySubmissionLimit) {
      throw new HttpsError(
        "resource-exhausted",
        "Du har sendt inn mange forslag i dag. Prøv igjen i morgen."
      );
    }

    if (!form.wantsGiveaway) {
      upsertRateLimit(transaction, rateLimitRef, rateLimitSnapshot, voteRef.id, createdAt);
      transaction.create(voteRef, voteData);
      return;
    }

    const entryKeys = buildGiveawayEntryKeys(form.giveawayContact, rateLimitSecret.value());
    const keyRefs = {
      nameEntryKey: db.collection("giveawayEntryKeys").doc(entryKeys.nameEntryKey),
      emailEntryKey: db.collection("giveawayEntryKeys").doc(entryKeys.emailEntryKey)
    };

    const keySnapshots = await Promise.all([
      transaction.get(keyRefs.nameEntryKey),
      transaction.get(keyRefs.emailEntryKey)
    ]);

    if (keySnapshots.some((snapshot) => snapshot.exists)) {
      throw new HttpsError(
        "already-exists",
        "Kontaktinformasjonen er allerede brukt i trekningen."
      );
    }

    const encryptedContact = encryptJson(form.giveawayContact, contactEncryptionKey.value());

    upsertRateLimit(transaction, rateLimitRef, rateLimitSnapshot, voteRef.id, createdAt);

    transaction.create(voteRef, {
      ...voteData,
      ...entryKeys
    });

    transaction.create(db.collection("giveawayEntries").doc(voteRef.id), {
      voteId: voteRef.id,
      city: form.city,
      encryptedContact,
      consentGiven: true,
      createdAt
    });

    transaction.create(keyRefs.nameEntryKey, {
      keyType: "name",
      voteId: voteRef.id,
      createdAt
    });

    transaction.create(keyRefs.emailEntryKey, {
      keyType: "email",
      voteId: voteRef.id,
      createdAt
    });
  });

  return { ok: true, voteId: voteRef.id };
});

function upsertRateLimit(transaction, rateLimitRef, rateLimitSnapshot, voteId, timestamp) {
  if (rateLimitSnapshot.exists) {
    transaction.update(rateLimitRef, {
      count: admin.firestore.FieldValue.increment(1),
      lastVoteId: voteId,
      updatedAt: timestamp
    });
    return;
  }

  transaction.create(rateLimitRef, {
    count: 1,
    firstVoteId: voteId,
    lastVoteId: voteId,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

exports.getGiveawayContact = onCall({
  secrets: [contactEncryptionKey],
  invoker: "public",
  enforceAppCheck: true
}, async (request) => {
  await assertCanReadContactInfo(request);

  const voteId = sanitizeString(request.data?.voteId || "");
  if (!/^[A-Za-z0-9_-]{8,}$/.test(voteId)) {
    throw new HttpsError("invalid-argument", "Ugyldig innsending.");
  }

  const snapshot = await db.collection("giveawayEntries").doc(voteId).get();
  if (!snapshot.exists) {
    return { contact: null };
  }

  const data = snapshot.data();
  if (data.encryptedContact) {
    return {
      contact: decryptJson(data.encryptedContact, contactEncryptionKey.value())
    };
  }

  return {
    contact: {
      fullName: sanitizeString(data.fullName || ""),
      phone: sanitizeString(data.phone || ""),
      email: normalizeEmail(data.email || "")
    }
  };
});

function normalizeVoteInput(data) {
  const city = sanitizeString(data.city || "");
  const cityConcept = sanitizeString(data.cityConcept || "");
  const cityConceptReason = sanitizeString(data.cityConceptReason || "");
  const wantsGiveaway = Boolean(data.wantsGiveaway);

  if (!campaignCities.includes(city)) {
    throw new HttpsError("invalid-argument", "Ugyldig by.");
  }

  if (cityConcept.length < 2 || cityConcept.length > 100) {
    throw new HttpsError("invalid-argument", "Skriv inn bygrepet du vil fremheve.");
  }

  if (cityConceptReason.length > 250) {
    throw new HttpsError("invalid-argument", "Begrunnelsen er for lang.");
  }

  if (!wantsGiveaway) {
    return {
      city,
      cityConcept,
      cityConceptReason,
      wantsGiveaway,
      giveawayContact: null
    };
  }

  const fullName = sanitizeString(data.fullName || "");
  const email = normalizeEmail(data.email || "");
  const consentGiven = data.consentGiven === true;

  if (fullName.length < 2 || fullName.length > 100) {
    throw new HttpsError("invalid-argument", "Skriv inn ditt fulle navn.");
  }

  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "Skriv inn en gyldig e-postadresse.");
  }

  if (!consentGiven) {
    throw new HttpsError("failed-precondition", "Samtykke mangler.");
  }

  return {
    city,
    cityConcept,
    cityConceptReason,
    wantsGiveaway,
    giveawayContact: {
      fullName,
      email
    }
  };
}

function getClientContext(request) {
  const browserId = sanitizeString(request.data?.browserId || "");
  const ip = sanitizeString(
    request.rawRequest.headers["fastly-client-ip"]
    || request.rawRequest.headers["x-forwarded-for"]
    || request.rawRequest.ip
    || ""
  ).split(",")[0].trim();
  const userAgent = sanitizeString(request.rawRequest.headers["user-agent"] || "");
  const day = new Date().toISOString().slice(0, 10);

  return {
    browserId,
    ip,
    userAgent,
    day
  };
}

function buildRateLimitKey(context, secret) {
  const source = [
    context.day,
    context.ip,
    context.userAgent,
    context.browserId
  ].join("|");
  return `submission_${context.day}_${hmacHex(source, secret)}`;
}

function buildGiveawayEntryKeys(contact, secret) {
  return {
    nameEntryKey: `name_${hmacHex(normalizeDuplicateKeyValue(contact.fullName), secret)}`,
    emailEntryKey: `email_${hmacHex(normalizeDuplicateKeyValue(contact.email), secret)}`
  };
}

function encryptJson(value, base64Key) {
  const key = getAesKey(base64Key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

function decryptJson(encryptedValue, base64Key) {
  const key = getAesKey(base64Key);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encryptedValue.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encryptedValue.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue.ciphertext, "base64")),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}

function getAesKey(base64Key) {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new HttpsError(
      "failed-precondition",
      "Krypteringsnøkkelen er ikke riktig konfigurert."
    );
  }

  return key;
}

async function assertCanReadContactInfo(request) {
  const email = normalizeEmail(request.auth?.token?.email || "");
  const provider = request.auth?.token?.firebase?.sign_in_provider || "";

  if (provider !== "microsoft.com" || !email) {
    throw new HttpsError("permission-denied", "Du har ikke tilgang til kontaktinfo.");
  }

  if (superAdminEmails.includes(email)) {
    return;
  }

  const adminSnapshot = await db.collection("adminUsers").doc(email).get();
  if (!adminSnapshot.exists || adminSnapshot.data()?.canReadContactInfo !== true) {
    throw new HttpsError("permission-denied", "Du har ikke tilgang til kontaktinfo.");
  }
}

function hmacHex(value, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");
}

function normalizeDuplicateKeyValue(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeString(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u2028\u2029]/g, " ")
    .trim();
}

function normalizeEmail(value) {
  return sanitizeString(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
