(function () {
  const EDIT_BUTTON_ID = "btn-enable-editor";
  const EDIT_STATUS_ID = "editor-lock-status";
  const state = {
    initialized: false,
    unlocked: false,
  };

  function getNodes() {
    const editor = document.getElementById("editor");
    const loadBtn = document.getElementById("btn-load-editor");
    const saveBtn = document.getElementById("btn-save-editor");
    const row = saveBtn ? saveBtn.closest(".row") : null;
    const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));
    return { editor, loadBtn, saveBtn, row, tabButtons };
  }

  function showTip(text) {
    if (typeof window.showToast === "function") {
      window.showToast(text);
    }
  }

  function ensureExtraControls(nodes) {
    let editBtn = document.getElementById(EDIT_BUTTON_ID);
    if (!editBtn && nodes.row) {
      editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.id = EDIT_BUTTON_ID;
      editBtn.textContent = "修改配置";

      if (nodes.saveBtn && nodes.saveBtn.parentElement === nodes.row) {
        nodes.row.insertBefore(editBtn, nodes.saveBtn);
      } else {
        nodes.row.appendChild(editBtn);
      }
    }

    let status = document.getElementById(EDIT_STATUS_ID);
    if (!status && nodes.row) {
      status = document.createElement("span");
      status.id = EDIT_STATUS_ID;
      status.className = "muted";
      status.style.alignSelf = "center";
      nodes.row.appendChild(status);
    }

    return { editBtn, status };
  }

  function setEditorEditable(unlocked, options) {
    const opts = options || {};
    const nodes = getNodes();
    const extras = ensureExtraControls(nodes);
    state.unlocked = !!unlocked;

    if (nodes.editor) {
      nodes.editor.readOnly = !state.unlocked;
      nodes.editor.setAttribute("aria-readonly", state.unlocked ? "false" : "true");
      nodes.editor.classList.toggle("editor-readonly", !state.unlocked);
      if (!state.unlocked) {
        nodes.editor.blur();
      }
    }

    if (nodes.saveBtn) {
      nodes.saveBtn.disabled = !state.unlocked;
    }

    if (extras.editBtn) {
      extras.editBtn.textContent = state.unlocked ? "锁定配置" : "修改配置";
    }

    if (extras.status) {
      extras.status.textContent = state.unlocked
        ? "编辑模式：已解锁"
        : "编辑模式：只读（点击“修改配置”并确认后可编辑）";
    }

    if (!opts.silent) {
      showTip(state.unlocked ? "已开启编辑模式" : "已锁定编辑模式");
    }
  }

  function bindGuard() {
    const nodes = getNodes();
    const extras = ensureExtraControls(nodes);
    if (!nodes.editor || !nodes.loadBtn || !nodes.saveBtn || !extras.editBtn) {
      return false;
    }
    if (state.initialized) {
      return true;
    }
    state.initialized = true;

    const originalLoad = nodes.loadBtn.onclick;
    nodes.loadBtn.onclick = async function (evt) {
      if (typeof originalLoad === "function") {
        await originalLoad.call(this, evt);
      }
      setEditorEditable(false, { silent: true });
    };

    const originalSave = nodes.saveBtn.onclick;
    nodes.saveBtn.onclick = async function (evt) {
      if (!state.unlocked) {
        showTip("请先点击“修改配置”并确认");
        return;
      }
      if (typeof originalSave === "function") {
        await originalSave.call(this, evt);
      }
      setEditorEditable(false, { silent: true });
    };

    extras.editBtn.onclick = function () {
      if (state.unlocked) {
        setEditorEditable(false);
        return;
      }
      const confirmed = window.confirm(
        "确认开启配置编辑模式？\n开启后才允许修改当前配置。"
      );
      if (!confirmed) {
        return;
      }
      setEditorEditable(true);
      nodes.editor.focus();
    };

    nodes.tabButtons.forEach((tab) => {
      tab.addEventListener("click", function () {
        if (state.unlocked) {
          setEditorEditable(false, { silent: true });
        }
      });
    });

    setEditorEditable(false, { silent: true });
    return true;
  }

  function initWithRetry(retryCount) {
    const count = Number(retryCount || 0);
    if (bindGuard()) {
      return;
    }
    if (count >= 40) {
      return;
    }
    setTimeout(function () {
      initWithRetry(count + 1);
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initWithRetry(0);
    });
  } else {
    initWithRetry(0);
  }
})();
