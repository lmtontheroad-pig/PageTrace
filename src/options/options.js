(function () {
  "use strict";

  const helper = window.KeywordHighlighter;
  const listElement = document.getElementById("keyword-list");
  const rowTemplate = document.getElementById("keyword-row-template");
  const addForm = document.getElementById("add-keyword-form");
  const newWordInput = document.getElementById("new-word");
  const newColorInput = document.getElementById("new-color");
  const saveButton = document.getElementById("save-settings");
  const resetButton = document.getElementById("reset-defaults");
  const statusText = document.getElementById("status-text");

  let settings = helper.normalizeSettings();

  function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("kw-status-error", isError);
    if (!message) return;
    window.setTimeout(() => {
      if (statusText.textContent === message) statusText.textContent = "";
    }, 2500);
  }

  function isValidCssColor(color) {
    return Boolean(color && CSS.supports("background-color", color));
  }

  function renderKeywords() {
    listElement.replaceChildren();
    settings.keywords.forEach((keyword) => {
      const row = rowTemplate.content.firstElementChild.cloneNode(true);
      const enabledInput = row.querySelector(".keyword-enabled");
      const wordInput = row.querySelector(".keyword-word");
      const colorInput = row.querySelector(".keyword-color");
      const deleteButton = row.querySelector(".keyword-delete");

      row.dataset.keywordId = keyword.id;
      enabledInput.checked = keyword.enabled !== false;
      wordInput.value = keyword.word;
      colorInput.value = keyword.color;

      enabledInput.addEventListener("change", () => {
        keyword.enabled = enabledInput.checked;
      });
      wordInput.addEventListener("input", () => {
        keyword.word = helper.normalizeKeywordText(wordInput.value);
      });
      colorInput.addEventListener("input", () => {
        keyword.color = colorInput.value.trim();
      });
      deleteButton.addEventListener("click", () => {
        settings.keywords = settings.keywords.filter((item) => item.id !== keyword.id);
        renderKeywords();
      });

      listElement.appendChild(row);
    });
  }

  function collectSettingsFromRows() {
    const keywords = Array.from(listElement.querySelectorAll(".kw-keyword-row"))
      .map((row) => ({
        id: row.dataset.keywordId,
        enabled: row.querySelector(".keyword-enabled").checked,
        word: helper.normalizeKeywordText(row.querySelector(".keyword-word").value),
        color: row.querySelector(".keyword-color").value.trim()
      }))
      .filter((keyword) => keyword.word);

    return helper.normalizeSettings({
      ...settings,
      keywords
    });
  }

  function validateSettings(nextSettings) {
    const invalidColor = nextSettings.keywords.find((keyword) => !isValidCssColor(keyword.color));
    if (invalidColor) {
      throw new Error(`颜色无效：${invalidColor.color}`);
    }
    if (nextSettings.keywords.length === 0) {
      throw new Error("至少保留一个关键词。");
    }
  }

  function saveCurrentSettings() {
    try {
      const nextSettings = collectSettingsFromRows();
      validateSettings(nextSettings);
      helper.saveSettings(nextSettings)
        .then((savedSettings) => {
          settings = savedSettings;
          renderKeywords();
          setStatus("已保存。");
        })
        .catch((error) => setStatus(error.message, true));
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const word = helper.normalizeKeywordText(newWordInput.value);
    const color = newColorInput.value.trim();

    if (!word) {
      setStatus("请输入关键词。", true);
      return;
    }
    if (!isValidCssColor(color)) {
      setStatus(`颜色无效：${color}`, true);
      return;
    }

    settings.keywords.push(helper.createKeyword(word, color));
    newWordInput.value = "";
    renderKeywords();
    setStatus("已新增，保存后生效。");
  });

  saveButton.addEventListener("click", saveCurrentSettings);

  resetButton.addEventListener("click", () => {
    settings = helper.normalizeSettings({
      enabled: true,
      keywords: helper.cloneDefaultKeywords()
    });
    renderKeywords();
    setStatus("已恢复默认，保存后生效。");
  });

  helper.getSettings()
    .then((storedSettings) => {
      settings = storedSettings;
      renderKeywords();
    })
    .catch((error) => {
      setStatus(error.message, true);
    });
})();
