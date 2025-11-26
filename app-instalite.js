// app-instalite.js
// ===================== DEV banner =====================
console.log("InstaLite app-instalite.js (Ganache + MetaMask)", Date.now());

// ===================== Config =====================
const RPC_HTTP = "http://127.0.0.1:8545";                 // Ganache RPC
const EXPECT_CHAIN_ID = 1337;                             // match Ganache
const WEB3_URL = "https://esm.sh/web3@4?bundle&v=" + Date.now();
const DEFAULT_ADDRESS = "";                               // optional prefill

const ABI_PATHS = [
  "/build/contracts/InstaLite.json",                      // Truffle artifact
];

// ===================== State =====================
let Web3Ctor = null;
let web3;
let accounts = [];
let activeAccount = null;
let contract;
let contractABI = null;
let bound = false;

// ===================== Utils =====================
const $  = (id) => document.getElementById(id);
const log = (m) => {
  console.log("[InstaLite]", m);
};

// dynamic Web3 import
async function dynamicImportWeb3() {
  if (Web3Ctor) return Web3Ctor;
  log("Importing Web3 module…");
  const mod = await import(WEB3_URL);
  if (!mod?.Web3) throw new Error("Web3 ESM not available");
  Web3Ctor = mod.Web3;
  log("Web3 module loaded");
  return Web3Ctor;
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
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
  throw new Error(
    `Unable to load ABI from known paths. ${lastErr?.message || lastErr || ""}`
  );
}

function applyActiveAccount(addr) {
  activeAccount = addr || null;
  try {
    if (contract) contract.options.from = activeAccount || undefined;
  } catch (_) {}
  // Update profile box label
  if ($("activeAccount")) {
    $("activeAccount").textContent = activeAccount || "Not Connected";
  }
}

function populateAccountSelect(list) {
  const sel = $("accountAddr");
  if (!sel) {
    log('Missing <select id="accountAddr"> in HTML');
    return;
  }
  sel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "---";
  sel.appendChild(placeholder);

  for (const a of list) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  }
}

function setActiveAccountFromUI() {
  const sel = $("accountAddr");
  const chosen = sel?.value || accounts[0];
  applyActiveAccount(chosen);
}

// ===================== RPC (Ganache) =====================
async function initRPC() {
  try {
    log(`Connecting to Ganache RPC at ${RPC_HTTP} ...`);
    const Web3 = await dynamicImportWeb3();

    web3 = new Web3(RPC_HTTP);

    accounts = await web3.eth.getAccounts();
    if (!accounts?.length) throw new Error("No accounts from Ganache. Is it running?");

    const chainId = await web3.eth.getChainId();
    const expected = BigInt(EXPECT_CHAIN_ID);

    if (EXPECT_CHAIN_ID != null && BigInt(chainId) !== expected) {
      log(`Warning: expected chainId ${EXPECT_CHAIN_ID} but got ${chainId}`);
    }

    populateAccountSelect(accounts);
    setActiveAccountFromUI();

    log(`RPC connected. Accounts: ${accounts.length}`);
  } catch (e) {
    console.error(e);
    alert("RPC init error: " + (e.message || e));
  }
}

// ===================== MetaMask (optional, via Connect Wallet) =====================
async function connectMetaMask() {
  await dynamicImportWeb3();

  if (!window.ethereum) {
    alert("MetaMask is required.");
    return;
  }

  web3 = new Web3Ctor(window.ethereum);
  accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) {
    alert("No accounts from MetaMask.");
    return;
  }

  log("MetaMask connected. Accounts: " + accounts.length);

  populateAccountSelect(accounts);
  setActiveAccountFromUI();

  await initContract(); // try to auto-load the contract
}

// ===================== Contract =====================
async function initContract() {
  try {
    if (!web3) {
      log("Init Ganache or connect MetaMask first");
      alert("Init Ganache or connect MetaMask first");
      return;
    }

    const addressInput = $("contractAddr");
    const manualAddr = (addressInput?.value || "").trim();
    let address = manualAddr || DEFAULT_ADDRESS;

    if (!address) {
      const artifact = await fetchJSON(ABI_PATHS[0]);
      const networkId = await web3.eth.net.getId();
      const deployed = artifact.networks?.[networkId];
      if (!deployed || !deployed.address) {
        alert("Contract address not provided and not found in artifact.");
        return;
      }
      address = deployed.address;
      if (addressInput) addressInput.value = address;
    }

    if (!address || !address.startsWith("0x")) {
      alert("Enter a valid 0x contract address");
      return;
    }

    const abi = await loadABI();
    contract = new web3.eth.Contract(abi, address);
    applyActiveAccount(activeAccount);

    log("InstaLite contract initialized at " + address);

    await loadFeed();
  } catch (e) {
    console.error(e);
    alert("Init contract error: " + (e.message || e));
  }
}

// ===================== IMAGE UPLOAD (LOCAL → BASE64, RESIZED) =====================
async function uploadImageAndGetURI() {
  const file = $("uploadImage")?.files?.[0];
  if (!file) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const scale = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const resizedURI = canvas.toDataURL("image/jpeg", 0.75);
        resolve(resizedURI);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ===================== InstaLite Actions =====================

// Create profile via "Create Account" button (prompts for username & role)
async function handleCreateAccount() {
  if (!contract) return alert("Load the contract first.");
  if (!activeAccount) return alert("Select an account or connect MetaMask.");

  const username = prompt("Enter a username for your profile:");
  if (!username) return;

  const roleStr = prompt(
    "Choose a role:\n1 = Basic\n2 = Creator\n3 = Business",
    "1"
  );
  const role = Number(roleStr || "0");
  if (![1, 2, 3].includes(role)) {
    alert("Invalid role. Use 1 (Basic), 2 (Creator), or 3 (Business).");
    return;
  }

  try {
    await contract.methods
      .createProfile(username, role)
      .send({ from: activeAccount });

    alert("Profile created/updated!");
  } catch (e) {
    console.error(e);
    alert("Profile error: " + (e.message || e));
  }
}

// Create post
async function createPost() {
  if (!contract) return alert("Load the contract first.");
  if (!activeAccount) return alert("Select an account or connect MetaMask.");

  const caption = $("caption")?.value.trim() || "";
  const mediaURI = await uploadImageAndGetURI();
  if (!mediaURI) return alert("Please upload an image first.");

  const isPremium = false; // could be wired to a checkbox later

  try {
    await contract.methods
      .createPost(mediaURI, caption, isPremium)
      .send({ from: activeAccount });

    alert("Post created!");
    if ($("caption")) $("caption").value = "";
    if ($("uploadImage")) $("uploadImage").value = "";

    await loadFeed();
  } catch (e) {
    console.error(e);
    alert("Create post error: " + (e.message || e));
  }
}

// Like post
async function likePost(postID) {
  if (!contract) return alert("Load the contract first.");
  if (!activeAccount) return alert("Select an account or connect MetaMask.");

  try {
    await contract.methods.likePost(postID).send({ from: activeAccount });
    await loadFeed();
  } catch (e) {
    console.error(e);
    alert("Like error: " + (e.message || e));
  }
}

// Tip from per-post button
async function tipPost(postID, toAddress) {
  if (!contract) return alert("Load the contract first.");
  if (!activeAccount) return alert("Select an account or connect MetaMask.");

  const amountStr = prompt("Enter tip amount in ETH (e.g. 0.05):", "0.01");
  if (!amountStr) return;
  const cleaned = amountStr.replace("ETH", "").trim();
  if (!cleaned) return alert("Invalid amount.");

  let valueWei;
  try {
    valueWei = web3.utils.toWei(cleaned, "ether");
  } catch (e) {
    return alert("Invalid ETH amount format.");
  }

  try {
    await contract.methods.tip(toAddress, postID).send({
      from: activeAccount,
      value: valueWei,
    });
    alert("Tip sent!");
  } catch (e) {
    console.error(e);
    alert("Tip error: " + (e.message || e));
  }
}

// Tip using aside section (#tipUser + #tipAmount)
async function tipFromAside() {
  if (!contract) return alert("Load the contract first.");
  if (!activeAccount) return alert("Select an account or connect MetaMask.");

  const sel = $("tipUser");
  const amtInput = $("tipAmount");
  if (!sel || !amtInput) return;

  const to = sel.value;
  const amountStr = amtInput.value.trim();
  if (!to) return alert("Select a user to tip.");
  if (!amountStr) return alert("Enter an amount to tip.");

  const cleaned = amountStr.replace("ETH", "").trim();
  if (!cleaned) return alert("Invalid amount.");

  let valueWei;
  try {
    valueWei = web3.utils.toWei(cleaned, "ether");
  } catch (e) {
    return alert("Invalid ETH amount format.");
  }

  // Use latest post of that user if available
  let postID = 0;
  try {
    const ids = await contract.methods.getUserPosts(to).call();
    if (ids.length) {
      postID = ids[ids.length - 1];
    }
  } catch (_) {
    // fallback: leave postID = 0
  }

  try {
    await contract.methods.tip(to, postID).send({
      from: activeAccount,
      value: valueWei,
    });
    alert("Tip sent!");
  } catch (e) {
    console.error(e);
    alert("Tip error: " + (e.message || e));
  }
}

// ===================== Feed Rendering =====================
function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function renderPost(post) {
  const feedSection = $("feed");
  if (!feedSection) return;

  const wrapper = document.createElement("div");
  wrapper.className = "post";

  const img = document.createElement("img");
  img.src = post.mediaURI;
  img.alt = "Post image";

  const captionP = document.createElement("p");
  const author = post.author;
  captionP.innerHTML = `<strong>@${shortenAddress(author)}</strong> ${post.caption}`;

  const likeBtn = document.createElement("button");
  likeBtn.className = "likeBtn";
  const likes = (window.likeCountCache && window.likeCountCache[post.postID]) || 0;
  likeBtn.textContent = `💛 Like (${likes})`;
  likeBtn.addEventListener("click", () => likePost(post.postID));

  const tipBtn = document.createElement("button");
  tipBtn.className = "tipBtn";
  tipBtn.textContent = "💰 Tip";
  tipBtn.addEventListener("click", () => tipPost(post.postID, author));

  wrapper.appendChild(img);
  wrapper.appendChild(captionP);
  wrapper.appendChild(likeBtn);
  wrapper.appendChild(tipBtn);

  feedSection.appendChild(wrapper);
}

async function loadFeed() {
  if (!contract) return;
  const feedSection = $("feed");
  if (!feedSection) return;

  // Reset feed, keep heading
  feedSection.innerHTML = "<h2>Recent Posts</h2>";

  const tipSelect = $("tipUser");
  if (tipSelect) {
    // reset tip user select; keep placeholder
    tipSelect.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "-- Choose a User --";
    tipSelect.appendChild(ph);
  }

  try {
    const postCount = await contract.methods.nextPostID().call();
    window.likeCountCache = {};
    const uniqueAuthors = new Set();

    for (let i = 1; i < postCount; i++) {
      const post = await contract.methods.posts(i).call();
      if (!post.postID || post.hidden) continue;

      const likeCount = await contract.methods.likeCount(i).call();
      window.likeCountCache[i] = Number(likeCount);

      renderPost(post);

      // fill aside tip user list with author addresses
      if (tipSelect && !uniqueAuthors.has(post.author)) {
        uniqueAuthors.add(post.author);
        const opt = document.createElement("option");
        opt.value = post.author;
        opt.textContent = `@${shortenAddress(post.author)}`;
        tipSelect.appendChild(opt);
      }
    }
  } catch (e) {
    console.error(e);
    log("Feed load error: " + (e.message || e));
  }
}

// ===================== Wire UI =====================
document.addEventListener("DOMContentLoaded", () => {
  if (bound) return;
  bound = true;

  // Init Ganache button (the unnamed "Init Ganache" button in header)
  const ganacheBtn = Array.from(document.querySelectorAll("header button"))
    .find((b) => b.textContent.toLowerCase().includes("init ganache"));
  ganacheBtn?.addEventListener("click", initRPC);

  // Account dropdown
  $("accountAddr")?.addEventListener("change", () => setActiveAccountFromUI());

  // Load contract button
  $("loadContract")?.addEventListener("click", initContract);

  // Connect Wallet (MetaMask)
  $("connectWallet")?.addEventListener("click", connectMetaMask);

  // Create Account (createProfile)
  $("createAccount")?.addEventListener("click", handleCreateAccount);

  // New post
  $("postButton")?.addEventListener("click", createPost);

  // Tip from aside
  $("tipAmountBtn")?.addEventListener("click", tipFromAside);

  log("InstaLite DApp ready — Init Ganache or connect wallet, pick an account, then load the contract.");
});
