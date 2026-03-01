import { Electroview } from "electrobun/view";
import type { PeekachuRPC } from "../shared/rpc-types.ts";

const rpc = Electroview.defineRPC<PeekachuRPC>({
  handlers: {
    requests: {},
    messages: {},
  },
});

const electroview = new Electroview({ rpc });

// --- DOM elements ---
const projectSelect = document.getElementById("project-select") as HTMLSelectElement;
const addForm = document.getElementById("add-form") as HTMLFormElement;
const secretNameInput = document.getElementById("secret-name") as HTMLInputElement;
const secretValueInput = document.getElementById("secret-value") as HTMLInputElement;
const formMessage = document.getElementById("form-message") as HTMLDivElement;
const emptyState = document.getElementById("empty-state") as HTMLDivElement;
const secretsTable = document.getElementById("secrets-table") as HTMLTableElement;
const secretsBody = document.getElementById("secrets-body") as HTMLTableSectionElement;

// --- State ---
let currentProject = "default";

// --- Helpers ---

function showMessage(text: string, type: "success" | "error") {
  formMessage.textContent = text;
  formMessage.className = `message ${type}`;
  formMessage.hidden = false;
  setTimeout(() => {
    formMessage.hidden = true;
  }, 3000);
}

// --- Data loading ---

async function loadProjects() {
  const projects = await electroview.rpc.request.listProjects({});
  projectSelect.innerHTML = "";

  // Always include "default" even if no secrets exist there yet
  const allProjects = new Set(["default", ...projects]);
  for (const project of allProjects) {
    const option = document.createElement("option");
    option.value = project;
    option.textContent = project;
    if (project === currentProject) option.selected = true;
    projectSelect.appendChild(option);
  }
}

async function loadSecrets() {
  const secrets = await electroview.rpc.request.listSecrets({ project: currentProject });
  secretsBody.innerHTML = "";

  if (secrets.length === 0) {
    emptyState.hidden = false;
    secretsTable.hidden = true;
    return;
  }

  emptyState.hidden = true;
  secretsTable.hidden = false;

  for (const name of secrets.sort()) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = name;
    tr.appendChild(tdName);

    const tdActions = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      if (deleteBtn.dataset.confirming) {
        handleDelete(name);
      } else {
        deleteBtn.dataset.confirming = "1";
        deleteBtn.textContent = "Confirm?";
        deleteBtn.classList.add("confirming");
        setTimeout(() => {
          if (deleteBtn.isConnected) {
            delete deleteBtn.dataset.confirming;
            deleteBtn.textContent = "Delete";
            deleteBtn.classList.remove("confirming");
          }
        }, 3000);
      }
    });
    tdActions.appendChild(deleteBtn);
    tr.appendChild(tdActions);

    secretsBody.appendChild(tr);
  }
}

async function loadStatus() {
  const status = await electroview.rpc.request.getStatus({});
  const platformEl = document.getElementById("status-platform")!;
  const providerEl = document.getElementById("status-provider")!;
  const nodeEl = document.getElementById("status-node")!;
  platformEl.textContent = `Platform: ${status.platform}`;
  providerEl.textContent = `Provider: ${status.provider}`;
  nodeEl.textContent = `Runtime: ${status.node}`;
}

async function refresh() {
  await loadProjects();
  await loadSecrets();
}

// --- Event handlers ---

projectSelect.addEventListener("change", () => {
  currentProject = projectSelect.value;
  loadSecrets();
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = secretNameInput.value.trim();
  const value = secretValueInput.value;

  if (!name || !value) return;

  const submitBtn = addForm.querySelector("button") as HTMLButtonElement;
  submitBtn.disabled = true;

  try {
    await electroview.rpc.request.setSecret({
      project: currentProject,
      name,
      value,
    });
    secretNameInput.value = "";
    secretValueInput.value = "";
    showMessage(`Secret "${name}" saved.`, "success");
    await refresh();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save secret";
    showMessage(msg, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

async function handleDelete(name: string) {
  try {
    const deleted = await electroview.rpc.request.deleteSecret({
      project: currentProject,
      name,
    });
    if (deleted) {
      showMessage(`Secret "${name}" deleted.`, "success");
    } else {
      showMessage(`Secret "${name}" not found.`, "error");
    }
    await refresh();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete secret";
    showMessage(msg, "error");
  }
}

// --- Init ---
loadStatus();
refresh();
