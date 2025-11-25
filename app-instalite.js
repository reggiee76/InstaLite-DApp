//app-instalite.js
// ===================== Config =====================
console.log("InstaLite Web3 script loaded", Date.now());

// ===================== Config =====================
const RPC_HTTP = "http://127.0.0.1:8545";                 // ganache-cli RPC
const EXPECT_CHAIN_ID = 1337;                             // match ganache --chain.chainId
const WEB3_URL = "https://esm.sh/web3@4?bundle&v=" + Date.now();
const ABI_PATH = "/build/contracts/InstaLite.json";

const ABI_PATHS = [
  "/build/contracts/instalite.json",                  // Truffle artifact
];

// ===================== State =====================
let Web3Ctor = null;
let web3;
let accounts = [];
let activeAccount = null;
let contract;

// ===================== Utils =====================
const $ = (id) => document.getElementById(id);

async function importWeb3() {
  if (Web3Ctor) return Web3Ctor;
  const mod = await import(WEB3_URL);
  Web3Ctor = mod.Web3;
  return Web3Ctor;
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Cannot fetch ${url}`);
  return res.json();
}

async function loadABI() {
  if (contractABI) return contractABI;
  let lastErr;
  for (const p of ABI_PATHS) {
    try {
      const artifact = await fetchJSON(p);
      if (artifact?.abi) {
        contractABI = artifact.abi;
        log(`ABI loaded from ${p}`);
        return contractABI;
      }
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Unable to load ABI from known paths. ${lastErr?.message || lastErr || ""}`);
}

function applyActiveAccount(addr) {
  activeFrom = addr || null;
  try { if (contract) contract.options.from = activeFrom || undefined; } catch (_) {}
}

function populateAccountSelect(list){
  const sel = $("accountSelect");
  if (!sel) { log('Missing <select id="accountSelect"> in HTML'); return; }
  sel.innerHTML = "";
  for (const a of list) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  }
}

function setActiveAccountFromUI(){
  const sel = $("accountSelect");
  const chosen = sel?.value || accounts[0];
  applyActiveAccount(chosen);
}

// ===================== Init: MetaMask =====================
async function connectMetaMask() {
  await importWeb3();

  if (!window.ethereum) {
    alert("MetaMask is required.");
    return;
  }

  web3 = new Web3Ctor(window.ethereum);
  accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  activeAccount = accounts[0];

  console.log("Connected:", activeAccount);
  await loadContract();
}

// ===================== RPC =====================
async function initRPC(){
  try{
    log(`Connecting to Ganache RPC at ${RPC_HTTP} ...`);
    const Web3 = await dynamicImportWeb3();

    // In web3@4 you can pass a URL string directly
    web3 = new Web3(RPC_HTTP);

    // Accounts (ganache provides unlocked accounts)
    accounts = await web3.eth.getAccounts();
    if (!accounts?.length) throw new Error("No accounts from Ganache. Is it running?");

    // Network / chain id
    const chainId = await web3.eth.getChainId();
    const expected = BigInt(EXPECT_CHAIN_ID);    // normalize your expected value

    if ($("network")) $("network").textContent = chainId.toString();
    if (EXPECT_CHAIN_ID != null && chainId !== expected) {
      log(`Warning: expected chainId ${EXPECT_CHAIN_ID} but got ${chainId}`);
    }

    populateAccountSelect(accounts);
    setActiveAccountFromUI();

    log(`RPC connected. Accounts: ${accounts.length}`);
  }catch(e){
    console.error(e);
    log("RPC init error: " + (e.message || e));
  }
}

// ===================== Load Contract =====================
async function initContract(){
  try{
    if(!web3){ log("Init RPC first"); return; }
    const address = ($("contractAddress")?.value||"").trim() || DEFAULT_ADDRESS;
    if(!address || !address.startsWith("0x")){ log("Enter a valid 0x address"); return; }

    const abi = await loadABI();

    // Clear previous instance
    contract = new web3.eth.Contract(abi, address);
    applyActiveAccount(activeFrom);

    if ($("contractStatus")) $("contractStatus").textContent = `Loaded at ${address}`;
    log("Contract initialized at " + address);

    await refreshState();
  }catch(e){
    log("Init error: " + (e.message || e));
  }
}

async function loadContract() {
  const artifact = await fetchJSON(ABI_PATH);
  const networkId = await web3.eth.net.getId();

  const deployed = artifact.networks[networkId];
  if (!deployed) {
    alert("Contract not deployed on this network.");
    return;
  }

  contract = new web3.eth.Contract(artifact.abi, deployed.address);

  console.log("Contract loaded at:", deployed.address);
}

// ===================== IMAGE UPLOAD (LOCAL → BASE64) =====================
async function uploadImageAndGetURI() {
  const file = $("uploadImage").files[0];
  if (!file) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (event) {

      // Create an <img> to resize
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const scale = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to compressed JPEG Base64
        const resizedURI = canvas.toDataURL("image/jpeg", 0.75);
        resolve(resizedURI);
      };

      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ===================== InstaLite: Create Post =====================
async function createPost() {
  if (!contract) return alert("Connect wallet first");

  const caption = $("caption").value.trim();
  const isPremium = false;

  // Convert image → Base64 URI
  const mediaURI = await uploadImageAndGetURI();
  if (!mediaURI) return alert("Please upload an image first");

  await contract.methods
    .createPost(mediaURI, caption, isPremium)
    .send({ from: activeAccount });

  alert("Post created!");
}

// ===================== InstaLite: Feed =====================

async function loadFeed() {
  const postCount = await contract.methods.nextPostID().call();

  const container = document.getElementById("postContainer");
  container.innerHTML = "";

  for (let i = 1; i < postCount; i++) {
    const post = await contract.methods.posts(i).call();
    if (!post.hidden) renderPost(post);
  }
}

// ===================== InstaLite: Like Post =====================
async function likePost(id) {
  await contract.methods.likePost(id).send({ from: activeAccount });
  loadFeed();
}

// ===================== Wire UI =====================
document.addEventListener("DOMContentLoaded", () => {

   // Init Ganache RPC
  $("connectBtn")?.addEventListener("click", initRPC);

   // Account dropdown changes "from" address
  $("accountSelect")?.addEventListener("change", ()=> setActiveAccountFromUI());
  
  //Contract + actions
  $("connectWallet")?.addEventListener("click", connectMetaMask);
  $("postButton")?.addEventListener("click", createPost);
  $("createProfileBtn")?.addEventListener("click", createProfile);

  log("Instalite DApp ready — click Init RPC (Ganache), pick an account, then load the contract.");
});

