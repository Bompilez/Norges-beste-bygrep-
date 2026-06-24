import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app-check.js";

import {
  getAuth,
  getIdTokenResult,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-functions.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDHrd5s3sCk45ZnIqk3DX9t30smlw7LeqQ",
  authDomain: "multiconsult-city-ranking.firebaseapp.com",
  projectId: "multiconsult-city-ranking",
  storageBucket: "multiconsult-city-ranking.firebasestorage.app",
  messagingSenderId: "333729190527",
  appId: "1:333729190527:web:56f8d1e328ccc70275e54a"
};

const recaptchaSiteKey = "6LfdI_0sAAAAAB6DYhwD03TbNC17Tr3CQd_SyfRQ";

const superAdminEmails = [
  "bjornar@eggedosis.no",
  "en@kime.no"
];

const bootstrapAdminEmails = [
  "bjornar@eggedosis.no"
];

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

let signedOutMessage = "Logg inn for å se innsendingene.";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
if (isRecaptchaSiteKeyConfigured()) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1");
const getGiveawayContacts = httpsCallable(functions, "getGiveawayContacts");
const microsoftProvider = new OAuthProvider("microsoft.com");

// Elements
const container = document.querySelector(".results");
const authStatus = document.querySelector(".auth-status");
const signInButton = document.querySelector(".sign-in-button");
const signOutButton = document.querySelector(".sign-out-button");
const toolbar = document.querySelector(".toolbar");
const submissionsList = document.querySelector(".submissions-list");
const adminManagementToggle = document.querySelector(".admin-management-toggle");
const adminManagement = document.querySelector(".admin-management");
const adminForm = document.querySelector(".admin-form");
const adminEmailInput = document.querySelector("#admin-email-input");
const adminContactAccessInput = document.querySelector("#admin-contact-access-input");
const adminManagementStatus = document.querySelector(".admin-management-status");
const adminList = document.querySelector(".admin-list");
const cityFilter = document.querySelector("#city-filter");
const giveawayFilter = document.querySelector("#giveaway-filter");
const sortFilter = document.querySelector("#sort-filter");
const searchFilter = document.querySelector("#search-filter");
const exportButton = document.querySelector(".export-button");
const resultsCount = document.querySelector(".results-count");
const pagination = document.querySelector(".pagination");

function isRecaptchaSiteKeyConfigured() {
  return recaptchaSiteKey.trim().length > 0
    && !recaptchaSiteKey.startsWith("PASTE_");
}

// Store all votes
let allVotes = [];
let currentFilteredVotes = [];
let dynamicAdminEmails = [];
let currentAdminCities = [];
let currentCanReadContactInfo = false;
let currentPage = 1;
const giveawayContactCache = new Map();
const pendingGiveawayContactIds = new Set();
const votesPerPage = 6;

signInButton.addEventListener("click", signInWithMicrosoft);
signOutButton.addEventListener("click", () => signOut(auth));
adminManagementToggle.addEventListener("click", toggleAdminManagement);
adminForm.addEventListener("submit", handleAdminAdd);
exportButton.addEventListener("click", downloadFilteredVotes);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setSignedOutState();
    return;
  }

  const canAccessAdmin = await setSignedInState(user);
  if (!canAccessAdmin) return;

  await loadVotes();
  loadAdminUsers();
});

async function signInWithMicrosoft() {
  setAuthStatus("Åpner Microsoft-innlogging...", "info");

  try {
    await signInWithPopup(auth, microsoftProvider);
  } catch (error) {
    setAuthStatus(getAuthErrorMessage(error), "error");
  }
}

function getAuthErrorMessage(error) {
  if (error.code === "auth/unauthorized-domain") {
    return "Domenet er ikke godkjent for admin-innlogging.";
  }

  if (error.code === "auth/popup-blocked") {
    return "Nettleseren blokkerte Microsoft-vinduet. Tillat popup-vinduer og prøv igjen.";
  }

  if (error.code === "auth/popup-closed-by-user") {
    return "Microsoft-innloggingen ble lukket før den var ferdig.";
  }

  if (error.code === "auth/operation-not-allowed") {
    return "Microsoft-innlogging er ikke aktivert for admin-panelet.";
  }

  if (error.code === "auth/account-exists-with-different-credential") {
    return "Denne e-posten er allerede knyttet til en annen innloggingsmetode.";
  }

  if (error.code === "auth/invalid-credential") {
    return "Microsoft-innloggingen returnerte ugyldig legitimasjon.";
  }

  return `Kunne ikke logge inn med Microsoft${error.code ? ` (${error.code})` : ""}.`;
}

async function setSignedInState(user) {
  const adminIdentity = await getAdminIdentity(user);
  const access = await getAdminAccess(adminIdentity.email);
  currentAdminCities = access.cities;
  currentCanReadContactInfo = access.canReadContactInfo;

  if (currentAdminCities.length === 0) {
    signedOutMessage = `Du har ikke tilgang til admin-siden. Innlogget konto var ${adminIdentity.email}.`;
    await signOut(auth);
    return false;
  }

  setAuthStatus(`Innlogget som ${adminIdentity.email}.`, "success");
  updateAdminUrl(adminIdentity.email);
  signInButton.classList.add("close");
  signOutButton.classList.remove("close");
  toolbar.classList.remove("close");
  submissionsList.classList.remove("close");
  setAdminManagementAvailable(isSuperAdminEmail(adminIdentity.email));
  updateCityFilterOptions(currentAdminCities);
  return true;
}

function setSignedOutState() {
  allVotes = [];
  currentFilteredVotes = [];
  currentAdminCities = [];
  currentCanReadContactInfo = false;
  giveawayContactCache.clear();
  pendingGiveawayContactIds.clear();
  container.innerHTML = "";
  pagination.innerHTML = "";
  pagination.classList.add("close");
  exportButton.disabled = true;
  currentPage = 1;
  resultsCount.textContent = "Logg inn for å laste inn forslag.";
  setAuthStatus(signedOutMessage, signedOutMessage.includes("ikke tilgang") ? "error" : "neutral");
  signedOutMessage = "Logg inn.";
  updateAdminUrl();
  signInButton.classList.remove("close");
  signOutButton.classList.add("close");
  toolbar.classList.add("close");
  submissionsList.classList.add("close");
  setAdminManagementAvailable(false);
}

function updateAdminUrl(email = "") {
  if (!window.history?.replaceState) return;

  const targetPath = email
    ? `/admin-logget-inn-som-${slugifyEmail(email)}`
    : "/admin";

  if (window.location.pathname !== targetPath) {
    window.history.replaceState({}, "", targetPath);
  }
}

function setAuthStatus(message, tone = "neutral") {
  setStatusMessage(authStatus, message, tone);
}

function setAdminManagementStatus(message, tone = "neutral") {
  setStatusMessage(adminManagementStatus, message, tone);
}

function setStatusMessage(element, message, tone = "neutral") {
  element.textContent = message;
  element.classList.remove("is-error", "is-success", "is-info");

  if (tone !== "neutral") {
    element.classList.add(`is-${tone}`);
  }
}

function slugifyEmail(email) {
  return normalizeEmail(email)
    .replace(/@/g, "-")
    .replace(/\./g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function setAdminManagementAvailable(isAvailable) {
  adminManagementToggle.classList.toggle("close", !isAvailable);
  adminManagement.classList.add("close");
  adminManagement.setAttribute("aria-hidden", "true");
  adminManagementToggle.setAttribute("aria-expanded", "false");
  adminManagementToggle.textContent = "Vis admin-brukere";
}

function toggleAdminManagement() {
  const isOpen = adminManagement.classList.contains("close");
  adminManagement.classList.toggle("close", !isOpen);
  adminManagement.setAttribute("aria-hidden", String(!isOpen));
  adminManagementToggle.setAttribute("aria-expanded", String(isOpen));
  adminManagementToggle.textContent = isOpen ? "Skjul admin-brukere" : "Vis admin-brukere";
}

// Load votes from Firebase
async function loadVotes() {
  try {
    if (currentAdminCities.length === 0) {
      allVotes = [];
      currentFilteredVotes = [];
      renderVotes(currentFilteredVotes);
      return;
    }

    const snapshot = await getDocs(collection(db, "votes"));

    allVotes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    giveawayContactCache.clear();
    pendingGiveawayContactIds.clear();

    currentPage = 1;
    applyFilters();

  } catch (error) {
    if (error.code === "permission-denied") {
      const adminIdentity = await getAdminIdentity(auth.currentUser);
      signedOutMessage = `Du har ikke tilgang til admin-siden. Innlogget konto var ${adminIdentity.email}.`;
      resultsCount.textContent = "Denne kontoen har ikke admin-tilgang.";
      await signOut(auth);
      return;
    }

    resultsCount.textContent = "Kunne ikke laste inn forslag.";
  }
}

async function loadAdminUsers() {
  const currentEmail = getCurrentUserEmail();
  if (!isSuperAdminEmail(currentEmail)) {
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "adminUsers"));
    dynamicAdminEmails = snapshot.docs
      .map((adminDoc) => {
        const data = adminDoc.data();
        return {
          email: data.email || adminDoc.id,
          canReadContactInfo: data.canReadContactInfo === true
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    renderAdminUsers();
    setAdminManagementStatus("");
  } catch {
    setAdminManagementStatus("Kunne ikke laste admin-listen.", "error");
  }
}

async function handleAdminAdd(event) {
  event.preventDefault();

  const email = normalizeEmail(adminEmailInput.value);
  const canReadContactInfo = Boolean(adminContactAccessInput.checked);
  if (!isValidEmail(email)) {
    setAdminManagementStatus("Skriv inn en gyldig e-postadresse.", "error");
    return;
  }

  try {
    const adminRef = doc(db, "adminUsers", email);
    const adminSnapshot = await getDoc(adminRef);

    if (adminSnapshot.exists()) {
      await updateDoc(adminRef, {
        canReadContactInfo
      });
      adminEmailInput.value = "";
      adminContactAccessInput.checked = false;
      setAdminManagementStatus(`${email} er allerede admin. Persondata-tilgang er oppdatert.`, "success");
      await loadAdminUsers();
      return;
    }

    await setDoc(adminRef, {
      email,
      canReadContactInfo,
      createdAt: serverTimestamp(),
      createdBy: getCurrentUserEmail()
    });

    adminEmailInput.value = "";
    adminContactAccessInput.checked = false;
    setAdminManagementStatus(`${email} har fått admin-tilgang.`, "success");
    await loadAdminUsers();
  } catch {
    setAdminManagementStatus("Kunne ikke legge til admin.", "error");
  }
}

async function handleAdminDelete(email) {
  try {
    await deleteDoc(doc(db, "adminUsers", email));
    setAdminManagementStatus(`${email} er fjernet fra admin-listen.`, "success");
    await loadAdminUsers();
  } catch {
    setAdminManagementStatus("Kunne ikke fjerne admin.", "error");
  }
}

async function handleAdminContactAccessChange(email, canReadContactInfo) {
  try {
    await updateDoc(doc(db, "adminUsers", email), {
      canReadContactInfo
    });
    setAdminManagementStatus(
      canReadContactInfo
        ? `${email} kan nå se persondata.`
        : `${email} kan ikke lenger se persondata.`,
      "success"
    );
    await loadAdminUsers();
  } catch {
    setAdminManagementStatus("Kunne ikke oppdatere tilgang til persondata.", "error");
    await loadAdminUsers();
  }
}

function renderAdminUsers() {
  adminList.innerHTML = "";

  const fixedAdmins = document.createElement("div");
  fixedAdmins.classList.add("admin-list-group");
  fixedAdmins.append(createAdminGroupTitle("Faste admins"));

  superAdminEmails.forEach((email) => {
    fixedAdmins.append(createAdminListItem(email, "Kan ikke fjernes."));
  });

  const dynamicAdmins = document.createElement("div");
  dynamicAdmins.classList.add("admin-list-group");
  dynamicAdmins.append(createAdminGroupTitle("Admins lagt til"));

  const removableAdminUsers = dynamicAdminEmails
    .filter((adminUser) => !isSuperAdminEmail(adminUser.email));

  if (removableAdminUsers.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("admin-empty-message");
    emptyMessage.textContent = "Ingen ekstra admin-brukere er lagt til ennå.";
    dynamicAdmins.append(emptyMessage);
  }

  removableAdminUsers.forEach((adminUser) => {
    const item = createAdminListItem(
      adminUser.email,
      adminUser.canReadContactInfo
        ? "Admin med tilgang til persondata"
        : "Admin"
    );
    const contactAccessLabel = document.createElement("label");
    contactAccessLabel.classList.add("admin-contact-access");

    const contactAccessCheckbox = document.createElement("input");
    contactAccessCheckbox.type = "checkbox";
    contactAccessCheckbox.checked = adminUser.canReadContactInfo;
    contactAccessCheckbox.addEventListener("change", () => {
      handleAdminContactAccessChange(adminUser.email, contactAccessCheckbox.checked);
    });

    contactAccessLabel.append(contactAccessCheckbox, "Persondata");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.classList.add("admin-remove-button");
    removeButton.textContent = "Fjern";
    removeButton.addEventListener("click", () => handleAdminDelete(adminUser.email));
    item.append(contactAccessLabel, removeButton);
    dynamicAdmins.append(item);
  });

  adminList.append(fixedAdmins, dynamicAdmins);
}

function createAdminGroupTitle(text) {
  const title = document.createElement("h3");
  title.textContent = text;

  return title;
}

function createAdminListItem(email, note = "") {
  const item = document.createElement("div");
  item.classList.add("admin-list-item");

  const textWrapper = document.createElement("div");

  const emailText = document.createElement("p");
  emailText.textContent = email;

  textWrapper.append(emailText);

  if (note) {
    const noteText = document.createElement("span");
    noteText.textContent = note;
    textWrapper.append(noteText);
  }

  item.append(textWrapper);

  return item;
}

function getCurrentUserEmail() {
  return normalizeEmail(auth.currentUser?.email || "");
}

function isSuperAdminEmail(email) {
  return superAdminEmails.includes(normalizeEmail(email));
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getAdminAccess(email) {
  const normalizedEmail = normalizeEmail(email);

  if (isSuperAdminEmail(normalizedEmail) || bootstrapAdminEmails.includes(normalizedEmail)) {
    return {
      cities: [...campaignCities],
      canReadContactInfo: isSuperAdminEmail(normalizedEmail)
    };
  }

  const adminSnapshot = await getDoc(doc(db, "adminUsers", normalizedEmail));
  if (!adminSnapshot.exists()) {
    return {
      cities: [],
      canReadContactInfo: false
    };
  }

  return {
    cities: [...campaignCities],
    canReadContactInfo: adminSnapshot.data().canReadContactInfo === true
  };
}

function updateCityFilterOptions(allowedCities) {
  cityFilter.innerHTML = "";

  if (allowedCities.length > 1) {
    cityFilter.append(createOption("all", "Alle byer"));
  }

  allowedCities.forEach((city) => {
    cityFilter.append(createOption(city, city));
  });
}

function createOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

async function getAdminIdentity(user) {
  if (!user) {
    return {
      email: "ukjent e-post",
      provider: "ukjent provider",
      uid: "ukjent UID"
    };
  }

  const tokenResult = await getIdTokenResult(user, true);
  const provider = tokenResult.claims.firebase?.sign_in_provider || "ukjent provider";

  return {
    email: user.email || tokenResult.claims.email || "ukjent e-post",
    provider,
    uid: user.uid
  };
}

// Render votes
function renderVotes(votes) {
  container.innerHTML = "";
  pagination.innerHTML = "";
  exportButton.disabled = votes.length === 0;

  if (votes.length === 0) {
    pagination.classList.add("close");
    resultsCount.textContent = "Viser 0 forslag";
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("empty-message");
    emptyMessage.textContent = "Ingen forslag matcher filtrene.";
    container.appendChild(emptyMessage);
    return;
  }

  const pageCount = Math.ceil(votes.length / votesPerPage);
  currentPage = Math.min(currentPage, pageCount);
  const pageStart = (currentPage - 1) * votesPerPage;
  const visibleVotes = votes.slice(pageStart, pageStart + votesPerPage);
  const visibleStart = pageStart + 1;
  const visibleEnd = pageStart + visibleVotes.length;

  resultsCount.textContent =
    votes.length === 1
      ? "Viser 1 forslag"
      : `Viser ${visibleStart}-${visibleEnd} av ${votes.length} forslag`;

  visibleVotes.forEach((data) => {
    container.appendChild(createVoteCard(data));
  });

  renderPagination(pageCount);
  loadVisibleGiveawayContactInfo(visibleVotes);
}

function renderPagination(pageCount) {
  if (pageCount <= 1) {
    pagination.classList.add("close");
    return;
  }

  pagination.classList.remove("close");

  const previousButton = createPaginationButton("Forrige", currentPage - 1);
  previousButton.disabled = currentPage === 1;
  pagination.append(previousButton);

  getVisiblePaginationPages(pageCount).forEach((page) => {
    if (page === "gap") {
      const gap = document.createElement("span");
      gap.classList.add("pagination-gap");
      gap.textContent = "...";
      pagination.append(gap);
      return;
    }

    const pageButton = createPaginationButton(String(page), page);
    pageButton.setAttribute("aria-label", `Gå til side ${page}`);

    if (page === currentPage) {
      pageButton.classList.add("is-active");
      pageButton.setAttribute("aria-current", "page");
    }

    pagination.append(pageButton);
  });

  const nextButton = createPaginationButton("Neste", currentPage + 1);
  nextButton.disabled = currentPage === pageCount;
  pagination.append(nextButton);
}

function getVisiblePaginationPages(pageCount) {
  if (pageCount <= 9) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    2,
    pageCount - 1,
    pageCount,
    currentPage - 1,
    currentPage,
    currentPage + 1
  ]);

  const visiblePages = [...pages]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);

  return visiblePages.flatMap((page, index) => {
    const previousPage = visiblePages[index - 1];
    if (index > 0 && page - previousPage > 1) {
      return ["gap", page];
    }

    return [page];
  });
}

function createPaginationButton(text, page) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("pagination-button");
  button.textContent = text;
  button.addEventListener("click", () => {
    currentPage = page;
    applyFilters();
  });

  return button;
}

function createVoteCard(data) {
  const card = document.createElement("article");
  card.classList.add("submission-card");
  card.dataset.voteId = data.id || "";

  const header = document.createElement("div");
  header.classList.add("submission-card-header");

  const titleGroup = document.createElement("div");

  const city = document.createElement("p");
  city.classList.add("submission-city");
  city.textContent = data.city || "Ukjent by";

  const concept = document.createElement("h2");
  concept.textContent = data.cityConcept || "Uten bygrep";

  titleGroup.append(city, concept);

  const meta = document.createElement("div");
  meta.classList.add("submission-meta");
  meta.append(
    createCompetitionStatus(Boolean(data.wantsGiveaway)),
    createTextElement(
      "time",
      data.createdAt ? data.createdAt.toDate().toLocaleString("no-NO") : "—"
    )
  );

  header.append(titleGroup, meta);

  const reason = createField("Begrunnelse", data.cityConceptReason || "—");
  reason.classList.add("submission-reason");

  const details = document.createElement("div");
  details.classList.add("submission-details");
  const contact = getCachedGiveawayContact(data);
  const hiddenContactText = getContactPlaceholderText(data);
  details.append(
    createField("ID", data.id || "—"),
    createField("Navn", contact.fullName || hiddenContactText, "fullName"),
    createField("E-post", contact.email || hiddenContactText, "email")
  );

  card.append(header, reason, details);

  return card;
}

function createField(label, value, contactKey = "") {
  const field = document.createElement("div");
  field.classList.add("submission-field");

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("p");
  valueElement.textContent = value;
  if (contactKey) {
    valueElement.dataset.contactKey = contactKey;
  }

  field.append(labelElement, valueElement);

  return field;
}

function getCachedGiveawayContact(vote) {
  if (!currentCanReadContactInfo || !vote.wantsGiveaway || !vote.giveawayEntryId) {
    return {};
  }

  return giveawayContactCache.get(vote.giveawayEntryId) || {};
}

function getContactPlaceholderText(vote) {
  if (!vote.wantsGiveaway) {
    return "—";
  }

  if (!currentCanReadContactInfo) {
    return "Skjult for denne adminrollen";
  }

  return "Laster...";
}

async function loadVisibleGiveawayContactInfo(visibleVotes) {
  if (!currentCanReadContactInfo) return;

  const voteIds = visibleVotes
    .filter((vote) => vote.wantsGiveaway && vote.giveawayEntryId)
    .map((vote) => vote.giveawayEntryId)
    .filter((voteId) => !giveawayContactCache.has(voteId))
    .filter((voteId) => !pendingGiveawayContactIds.has(voteId));

  if (voteIds.length === 0) return;

  voteIds.forEach((voteId) => pendingGiveawayContactIds.add(voteId));

  try {
    const result = await getGiveawayContacts({ voteIds });
    Object.entries(result.data?.contacts || {}).forEach(([voteId, contact]) => {
      giveawayContactCache.set(voteId, contact);
    });
    updateVisibleContactFields(voteIds);
  } catch {
    updateVisibleContactFields(voteIds, "Kunne ikke hente persondata");
  } finally {
    voteIds.forEach((voteId) => pendingGiveawayContactIds.delete(voteId));
  }
}

function updateVisibleContactFields(giveawayEntryIds, fallbackText = "—") {
  const visibleEntryIds = new Set(giveawayEntryIds);

  currentFilteredVotes.forEach((vote) => {
    if (!visibleEntryIds.has(vote.giveawayEntryId)) return;

    const card = container.querySelector(`[data-vote-id="${CSS.escape(vote.id)}"]`);
    if (!card) return;

    const contact = giveawayContactCache.get(vote.giveawayEntryId) || {};
    const fullName = card.querySelector('[data-contact-key="fullName"]');
    const email = card.querySelector('[data-contact-key="email"]');

    if (fullName) {
      fullName.textContent = contact.fullName || fallbackText;
    }

    if (email) {
      email.textContent = contact.email || fallbackText;
    }
  });
}

function createCompetitionStatus(isInCompetition) {
  const badge = document.createElement("span");
  badge.classList.add(
    "submission-badge",
    isInCompetition ? "is-in-competition" : "is-not-in-competition"
  );
  badge.textContent = isInCompetition
    ? "Med i konkurransen"
    : "Ikke med i konkurransen";

  return badge;
}

function createTextElement(tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;

  return element;
}

function applyFilters() {
  currentFilteredVotes = getFilteredVotes();
  renderVotes(currentFilteredVotes);
}

function getFilteredVotes() {
  const selectedCity = cityFilter.value;
  const selectedGiveaway = giveawayFilter.value;
  const selectedSort = sortFilter.value;
  const searchValue = searchFilter.value.toLowerCase().trim();

  let filteredVotes = allVotes.filter((vote) => {
    const matchesCity =
      selectedCity === "all" || vote.city === selectedCity;

    const matchesGiveaway =
      selectedGiveaway === "all" ||
      (selectedGiveaway === "yes" && vote.wantsGiveaway) ||
      (selectedGiveaway === "no" && !vote.wantsGiveaway);

    const searchableText = `
      ${vote.city}
      ${vote.id}
      ${vote.cityConcept}
      ${vote.cityConceptReason}
    `.toLowerCase();

    const matchesSearch =
      searchValue === "" || searchableText.includes(searchValue);

    return matchesCity && matchesGiveaway && matchesSearch;
  });

  filteredVotes.sort((a, b) => {
    const dateA = a.createdAt?.toDate() || new Date(0);
    const dateB = b.createdAt?.toDate() || new Date(0);

    return selectedSort === "newest"
      ? dateB - dateA
      : dateA - dateB;
  });

  return filteredVotes;
}

function downloadFilteredVotes() {
  if (currentFilteredVotes.length === 0) return;

  const headers = [
    "By",
    "Bygrep",
    "Begrunnelse",
    "Med i konkurransen",
    "Innsendt",
    "ID"
  ];

  const rows = currentFilteredVotes.map((vote) => [
    vote.city || "",
    vote.cityConcept || "",
    vote.cityConceptReason || "",
    vote.wantsGiveaway ? "Ja" : "Nei",
    formatDateForExport(vote.createdAt),
    vote.id || ""
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(formatCsvCell).join(";"))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bygrep-forslag-${getExportDateStamp()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCsvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function formatDateForExport(timestamp) {
  return timestamp
    ? timestamp.toDate().toLocaleString("no-NO")
    : "";
}

function getExportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

cityFilter.addEventListener("change", handleFilterChange);
giveawayFilter.addEventListener("change", handleFilterChange);
sortFilter.addEventListener("change", handleFilterChange);
searchFilter.addEventListener("input", handleFilterChange);

function handleFilterChange() {
  currentPage = 1;
  applyFilters();
}
