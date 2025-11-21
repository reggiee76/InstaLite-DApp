//app-instalite.js
// ===================== Config =====================
console.log("InstaLite Web3 script loaded", Date.now());

const WEB3_URL = "https://esm.sh/web3@4?bundle&v=" + Date.now();
const ABI_PATH = "/build/contracts/InstaLite.json";

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

// ===================== Load Contract =====================
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

// ===================== Wire UI =====================
document.addEventListener("DOMContentLoaded", () => {
  
  // Fixed IDs to match your HTML:
  $("connectWallet")?.addEventListener("click", connectMetaMask);
  $("postButton")?.addEventListener("click", createPost);
  $("createProfileBtn")?.addEventListener("click", createProfile);

  console.log("InstaLite front-end ready.");
});
