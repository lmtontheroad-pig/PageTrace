(function () {
  "use strict";

  const statusElement = document.getElementById("page-status");
  const totalElement = document.getElementById("total-count");
  const countsElement = document.getElementById("keyword-counts");
  const enableButton = document.getElementById("enable-button");
  const pauseButton = document.getElementById("pause-button");
  const rescanButton = document.getElementById("rescan-button");

  function setBusy(isBusy) {
    enableButton.disabled = isBusy;
    pauseButton.disabled = isBusy;
    rescanButton.disabled = isBusy;
  }

  function renderUnavailable(message) {
    statusElement.textContent = message;
    totalElement.textContent = "0";
    countsElement.replaceChildren();
    [enableButton, pauseButton, rescanButton].forEach((button) => {
      button.disabled = true;
    });
  }

  function renderStats(stats) {
    statusElement.textContent = stats.enabled ? "当前页面已启用" : "当前页面已暂停";
    totalElement.textContent = String(stats.total);
    countsElement.replaceChildren();

    const enabledKeywords = stats.keywords.filter((keyword) => keyword.enabled);
    if (enabledKeywords.length === 0) {
      const empty = document.createElement("p");
      empty.className = "kw-empty-text";
      empty.textContent = "没有启用的关键词。";
      countsElement.appendChild(empty);
      return;
    }

    enabledKeywords.forEach((keyword) => {
      const row = document.createElement("div");
      row.className = "kw-count-row";

      const swatch = document.createElement("span");
      swatch.className = "kw-color-swatch";
      swatch.style.backgroundColor = keyword.color;

      const word = document.createElement("span");
      word.className = "kw-count-word";
      word.textContent = keyword.word;

      const count = document.createElement("strong");
      count.className = "kw-count-number";
      count.textContent = String(keyword.count);

      row.append(swatch, word, count);
      countsElement.appendChild(row);
    });
  }

  function queryActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!tabs[0] || typeof tabs[0].id !== "number") {
          reject(new Error("未找到当前标签页。"));
          return;
        }
        resolve(tabs[0]);
      });
    });
  }

  function sendMessage(type) {
    return queryActiveTab().then((tab) => new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error("当前页面未匹配或脚本尚未注入。"));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error((response && response.error) || "页面脚本未响应。"));
          return;
        }
        resolve(response.payload);
      });
    }));
  }

  function refresh() {
    setBusy(true);
    sendMessage("KWH_GET_STATS")
      .then(renderStats)
      .catch((error) => renderUnavailable(error.message))
      .finally(() => setBusy(false));
  }

  function performAction(type) {
    setBusy(true);
    sendMessage(type)
      .then(renderStats)
      .catch((error) => renderUnavailable(error.message))
      .finally(() => setBusy(false));
  }

  enableButton.addEventListener("click", () => performAction("KWH_ENABLE"));
  pauseButton.addEventListener("click", () => performAction("KWH_DISABLE"));
  rescanButton.addEventListener("click", () => performAction("KWH_RESCAN"));

  refresh();
})();
