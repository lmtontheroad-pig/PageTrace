(function () {
  "use strict";

  const helper = window.KeywordHighlighter;
  const listElement = document.getElementById("keyword-list");
  const rowTemplate = document.getElementById("keyword-row-template");
  const addForm = document.getElementById("add-keyword-form");
  const newWordInput = document.getElementById("new-word");
  const newColorInput = document.getElementById("new-color");
  const newSemanticColorInput = document.getElementById("new-semantic-color");
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

  function clampRgbChannel(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return 0;
    return Math.min(255, Math.max(0, number));
  }

  function rgbToHex({ r, g, b }) {
    return `#${[r, g, b]
      .map((value) => clampRgbChannel(value).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function rgbToCss(rgb) {
    return `rgb(${clampRgbChannel(rgb.r)}, ${clampRgbChannel(rgb.g)}, ${clampRgbChannel(rgb.b)})`;
  }

  function parseColorToRgb(color) {
    const value = String(color || "").trim();
    const rgbMatch = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgbMatch) {
      return {
        r: clampRgbChannel(rgbMatch[1]),
        g: clampRgbChannel(rgbMatch[2]),
        b: clampRgbChannel(rgbMatch[3])
      };
    }

    const hexMatch = value.match(/^#?([0-9a-f]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16)
      };
    }

    return { r: 255, g: 255, b: 0 };
  }

  function bindColorEditor(editor, initialColor, onChange) {
    const picker = editor.querySelector(".keyword-color-picker");
    const redInput = editor.querySelector(".keyword-color-r");
    const greenInput = editor.querySelector(".keyword-color-g");
    const blueInput = editor.querySelector(".keyword-color-b");
    const valueInput = editor.querySelector(".keyword-color-value");

    function setRgb(rgb, source) {
      const nextRgb = {
        r: clampRgbChannel(rgb.r),
        g: clampRgbChannel(rgb.g),
        b: clampRgbChannel(rgb.b)
      };
      redInput.value = String(nextRgb.r);
      greenInput.value = String(nextRgb.g);
      blueInput.value = String(nextRgb.b);
      picker.value = rgbToHex(nextRgb);
      valueInput.value = rgbToCss(nextRgb);
      if (source !== "init" && typeof onChange === "function") {
        onChange(valueInput.value);
      }
    }

    picker.addEventListener("input", () => {
      setRgb(parseColorToRgb(picker.value), "picker");
    });

    [redInput, greenInput, blueInput].forEach((input) => {
      input.addEventListener("input", () => {
        setRgb({
          r: redInput.value,
          g: greenInput.value,
          b: blueInput.value
        }, "channels");
      });
    });

    setRgb(parseColorToRgb(initialColor), "init");

    return {
      valueInput,
      getValue: () => valueInput.value,
      setValue: (color, silent = false) => setRgb(parseColorToRgb(color), silent ? "init" : "program")
    };
  }

  function renderKeywords() {
    listElement.replaceChildren();
    settings.keywords.forEach((keyword) => {
      const row = rowTemplate.content.firstElementChild.cloneNode(true);
      const enabledInput = row.querySelector(".keyword-enabled");
      const wordInput = row.querySelector(".keyword-word");
      const colorEditor = row.querySelector("[data-color-role='primary']");
      const semanticColorEditor = row.querySelector("[data-color-role='semantic']");
      const deleteButton = row.querySelector(".keyword-delete");
      let semanticColorTouched = Boolean(keyword.semanticColor && keyword.semanticColor !== keyword.color);

      row.dataset.keywordId = keyword.id;
      enabledInput.checked = keyword.enabled !== false;
      wordInput.value = keyword.word;
      const semanticColorApi = bindColorEditor(semanticColorEditor, keyword.semanticColor || keyword.color, (color) => {
        semanticColorTouched = true;
        keyword.semanticColor = color;
      });
      bindColorEditor(colorEditor, keyword.color, (color) => {
        if (!semanticColorTouched) {
          semanticColorApi.setValue(color, true);
          keyword.semanticColor = color;
        }
        keyword.color = color;
      });

      enabledInput.addEventListener("change", () => {
        keyword.enabled = enabledInput.checked;
      });
      wordInput.addEventListener("input", () => {
        keyword.word = helper.normalizeKeywordText(wordInput.value);
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
        color: row.querySelector("[data-color-role='primary'] .keyword-color-value").value.trim(),
        semanticColor: row.querySelector("[data-color-role='semantic'] .keyword-color-value").value.trim()
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
    const invalidSemanticColor = nextSettings.keywords.find((keyword) => !isValidCssColor(keyword.semanticColor));
    if (invalidSemanticColor) {
      throw new Error(`弱语义颜色无效：${invalidSemanticColor.semanticColor}`);
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
    const semanticColor = newSemanticColorInput.value.trim() || color;

    if (!word) {
      setStatus("请输入关键词。", true);
      return;
    }
    if (!isValidCssColor(color)) {
      setStatus(`颜色无效：${color}`, true);
      return;
    }
    if (!isValidCssColor(semanticColor)) {
      setStatus(`弱语义颜色无效：${semanticColor}`, true);
      return;
    }

    settings.keywords.push(helper.createKeyword(word, color, semanticColor));
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

  let newSemanticColorTouched = false;
  const newSemanticColorApi = bindColorEditor(document.querySelector("#add-keyword-form [data-color-role='semantic']"), newSemanticColorInput.value, (color) => {
    newSemanticColorTouched = true;
    newSemanticColorInput.value = color;
  });
  bindColorEditor(document.querySelector("#add-keyword-form [data-color-role='primary']"), newColorInput.value, (color) => {
    newColorInput.value = color;
    if (!newSemanticColorTouched) {
      newSemanticColorApi.setValue(color, true);
      newSemanticColorInput.value = color;
    }
  });
})();
