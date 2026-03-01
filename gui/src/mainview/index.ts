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
const addProjectBtn = document.getElementById("add-project-btn") as HTMLButtonElement;
const addProjectForm = document.getElementById("add-project-form") as HTMLDivElement;
const newProjectNameInput = document.getElementById("new-project-name") as HTMLInputElement;
const createProjectBtn = document.getElementById("create-project-btn") as HTMLButtonElement;
const addForm = document.getElementById("add-form") as HTMLFormElement;
const secretNameInput = document.getElementById("secret-name") as HTMLInputElement;
const secretValueInput = document.getElementById("secret-value") as HTMLInputElement;
const secretCommentInput = document.getElementById("secret-comment") as HTMLInputElement;
const formMessage = document.getElementById("form-message") as HTMLDivElement;
const emptyState = document.getElementById("empty-state") as HTMLDivElement;
const secretsTable = document.getElementById("secrets-table") as HTMLTableElement;
const secretsBody = document.getElementById("secrets-body") as HTMLTableSectionElement;

// --- State ---
let currentProject = "default";
let comments: Record<string, string> = {};

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

async function loadComments() {
  comments = await electroview.rpc.request.getComments({ project: currentProject });
}

async function loadSecrets() {
  const secrets = await electroview.rpc.request.listSecrets({ project: currentProject });
  await loadComments();
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

    const tdComment = document.createElement("td");
    tdComment.className = "comment-cell";
    tdComment.textContent = comments[name] ?? "";
    tr.appendChild(tdComment);

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
  const comment = secretCommentInput.value.trim();

  if (!name || !value) return;

  const submitBtn = addForm.querySelector("button") as HTMLButtonElement;
  submitBtn.disabled = true;

  try {
    await electroview.rpc.request.setSecret({
      project: currentProject,
      name,
      value,
    });

    if (comment) {
      await electroview.rpc.request.setComment({
        project: currentProject,
        name,
        comment,
      });
    }

    secretNameInput.value = "";
    secretValueInput.value = "";
    secretCommentInput.value = "";
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

// --- Project creation ---

addProjectBtn.addEventListener("click", () => {
  addProjectBtn.hidden = true;
  addProjectForm.hidden = false;
  newProjectNameInput.value = "";
  newProjectNameInput.focus();
});

function cancelProjectCreation() {
  addProjectForm.hidden = true;
  addProjectBtn.hidden = false;
}

newProjectNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cancelProjectCreation();
});

createProjectBtn.addEventListener("click", async () => {
  const name = newProjectNameInput.value.trim().toLowerCase();
  if (!name) return;

  createProjectBtn.disabled = true;
  try {
    await electroview.rpc.request.createProject({ project: name });
    currentProject = name;
    cancelProjectCreation();
    await refresh();
    showMessage(`Project "${name}" created.`, "success");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create project";
    showMessage(msg, "error");
  } finally {
    createProjectBtn.disabled = false;
  }
});

newProjectNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    createProjectBtn.click();
  }
});

// --- Init ---
loadStatus();
refresh();
