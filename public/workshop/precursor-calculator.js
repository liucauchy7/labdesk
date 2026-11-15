/* 钙钛矿前驱体配方计算器 — 设计：马鸣宇，集成版 */
(function () {
  const PRESETS = [
    { name: "FAI", mass: 171.97 },
    { name: "PbI2", mass: 461.01 },
    { name: "CsI", mass: 259.81 },
    { name: "MABr", mass: 111.97 },
    { name: "FABr", mass: 124.97 },
    { name: "PbBr2", mass: 367.01 },
    { name: "MACl", mass: 67.52 },
    { name: "SnI2", mass: 372.52 },
    { name: "SnF2", mass: 156.71 },
    { name: "PbCl2", mass: 278.10 },
    { name: "PEAI", mass: 547.20 },
    { name: "GuaSCN", mass: 118.16 },
  ];

  const state = {
    salts: [
      { name: "FAI", mass: 171.97, ratio: 100, unit: "mol%" },
      { name: "PbI2", mass: 461.01, ratio: 100, unit: "mol%" },
    ],
  };

  const $ = (id) => document.getElementById(id);
  const num = (id, fallback) => {
    const value = Number($(id).value);
    return Number.isFinite(value) ? value : fallback;
  };
  const fmt = (value, digits) => {
    if (!Number.isFinite(value)) return "--";
    return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  };

  function totals() {
    const pieces = Math.max(0, num("pieces", 0));
    const perPiece = Math.max(0, num("perPiece", 0));
    const excess = Math.max(0, num("excess", 0));
    const loss = Math.max(0, num("loss", 0));
    const theoretical = pieces * perPiece;
    const extra = theoretical * (excess / 100) + loss;
    const total = theoretical + extra;
    return { theoretical, extra, total };
  }

  function nRef(totalUl) {
    const conc = Math.max(0, num("conc", 0));
    return conc * (totalUl / 1000); // mol/L × mL = mmol
  }

  function balanceStep() {
    const value = num("balance", 0.01);
    return value > 0 ? value : 0.01;
  }

  function roundTo(value, step) {
    return Math.round(value / step) * step;
  }

  function renderSalts() {
    const list = $("saltList");
    list.innerHTML = "";
    state.salts.forEach((salt, index) => {
      const row = document.createElement("div");
      row.className = "ws-salt-row";
      row.innerHTML = `
        <input class="name" data-field="name" data-index="${index}" value="${salt.name}">
        <input data-field="mass" data-index="${index}" type="number" step="0.01" value="${salt.mass}" title="摩尔质量 g/mol">
        <input data-field="ratio" data-index="${index}" type="number" step="1" value="${salt.ratio}">
        <select data-field="unit" data-index="${index}"><option${salt.unit === "mol%" ? " selected" : ""}>mol%</option><option${salt.unit === "eq" ? " selected" : ""}>eq</option></select>
        <button class="ws-del" type="button" data-del="${index}" title="删除">×</button>`;
      list.appendChild(row);
    });
    $("saltCount").textContent = `${state.salts.length} 种药品`;
    list.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.dataset.index);
        const field = input.dataset.field;
        const salt = state.salts[index];
        if (!salt) return;
        if (field === "name" || field === "unit") salt[field] = input.value;
        else salt[field] = Number(input.value) || 0;
        compute();
      });
    });
    list.querySelectorAll("[data-del]").forEach((button) => {
      button.addEventListener("click", () => {
        state.salts.splice(Number(button.dataset.del), 1);
        renderSalts();
        compute();
      });
    });
  }

  function renderWeigh(nref) {
    const step = balanceStep();
    const list = $("weighList");
    list.innerHTML = "";
    state.salts.forEach((salt) => {
      const ratio = salt.unit === "eq" ? salt.ratio * 100 : salt.ratio;
      const target = nref * (ratio / 100) * salt.mass;
      const actual = roundTo(target, step);
      const delta = target > 0 ? ((actual - target) / target) * 100 : 0;
      const row = document.createElement("div");
      row.className = "ws-weigh";
      row.innerHTML = `<span>${salt.name || "未命名"}</span><strong>${fmt(actual, 2)} mg</strong>
        <small>目标 ${fmt(target, 2)} mg · 偏差 ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}%</small>`;
      list.appendChild(row);
    });
    $("nref").textContent = `n_ref ${fmt(nref, 3)} mmol`;
  }

  function renderSolvents(totalUl) {
    const ratioText = $("solventRatio").value || "";
    const names = ($("solventName").value || "").split(":").map((part) => part.trim()).filter(Boolean);
    const ratios = ratioText.split(":").map((part) => Number(part.trim())).filter((value) => Number.isFinite(value) && value > 0);
    const box = $("solventSplit");
    box.innerHTML = "";
    if (!names.length || !ratios.length) {
      $("solventTotal").textContent = "";
      return;
    }
    const sum = ratios.reduce((a, b) => a + b, 0);
    names.forEach((name, index) => {
      const share = ratios[index] ?? 0;
      const volume = sum > 0 ? (totalUl * share) / sum : 0;
      const chip = document.createElement("span");
      chip.textContent = `${name} ${fmt(volume, 1)} µL`;
      box.appendChild(chip);
    });
    $("solventTotal").textContent = `合计 ${fmt(totalUl, 0)} µL`;
  }

  function compute() {
    const { theoretical, extra, total } = totals();
    $("theoretical").textContent = fmt(theoretical, 0);
    $("extra").textContent = fmt(extra, 0);
    $("total").textContent = fmt(total, 0);
    const nref = nRef(total);
    renderWeigh(nref);
    renderSolvents(total);
  }

  function addSalt() {
    const preset = $("preset").value;
    const customName = $("customName").value.trim();
    const customMass = Number($("customMass").value);
    if (preset) {
      const found = PRESETS.find((item) => item.name === preset);
      if (found) state.salts.push({ name: found.name, mass: found.mass, ratio: 100, unit: "mol%" });
    } else if (customName) {
      state.salts.push({ name: customName, mass: Number.isFinite(customMass) && customMass > 0 ? customMass : 0, ratio: 100, unit: "mol%" });
    } else {
      return;
    }
    $("preset").value = "";
    $("customName").value = "";
    $("customMass").value = "";
    renderSalts();
    compute();
  }

  function recipeSnapshot() {
    return {
      conc: $("conc").value,
      pieces: $("pieces").value,
      perPiece: $("perPiece").value,
      excess: $("excess").value,
      loss: $("loss").value,
      balance: $("balance").value,
      solventName: $("solventName").value,
      solventRatio: $("solventRatio").value,
      salts: state.salts.map((salt) => ({ ...salt })),
    };
  }

  function applyRecipe(recipe) {
    if (!recipe) return;
    ["conc", "pieces", "perPiece", "excess", "loss", "balance", "solventName", "solventRatio"].forEach((key) => {
      if (recipe[key] !== undefined && $(key)) $(key).value = recipe[key];
    });
    state.salts = Array.isArray(recipe.salts) && recipe.salts.length
      ? recipe.salts.map((salt) => ({ name: salt.name || "未命名", mass: Number(salt.mass) || 0, ratio: Number(salt.ratio) || 0, unit: salt.unit === "eq" ? "eq" : "mol%" }))
      : state.salts;
    renderSalts();
    compute();
  }

  function savedList() {
    try {
      return JSON.parse(localStorage.getItem("labdesk.recipes") || "{}");
    } catch (error) {
      return {};
    }
  }

  function refreshSaved(selectName) {
    const recipes = savedList();
    const select = $("savedRecipes");
    select.innerHTML = '<option value="">已保存配方…</option>';
    Object.keys(recipes).sort().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    if (selectName) select.value = selectName;
  }

  function exportCsv() {
    const { total } = totals();
    const nref = nRef(total);
    const step = balanceStep();
    const rows = [["药品", "摩尔质量(g/mol)", "比例", "单位", "目标(mg)", "称量(mg)", "偏差(%)"]];
    state.salts.forEach((salt) => {
      const ratio = salt.unit === "eq" ? salt.ratio * 100 : salt.ratio;
      const target = nref * (ratio / 100) * salt.mass;
      const actual = roundTo(target, step);
      rows.push([salt.name, salt.mass, salt.ratio, salt.unit, target.toFixed(3), actual.toFixed(3),
        (target > 0 ? ((actual - target) / target) * 100 : 0).toFixed(3)]);
    });
    rows.push([]);
    rows.push(["建议配液(µL)", total.toFixed(1), "n_ref(mmol)", nref.toFixed(3)]);
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `配方-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  }

  function init() {
    const back = document.getElementById("wsBack");
    if (back) {
      back.addEventListener("click", (event) => {
        if (history.length > 1 && document.referrer.indexOf(location.host) >= 0) {
          event.preventDefault();
          history.back();
        }
      });
    }
    const preset = $("preset");
    PRESETS.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = `${item.name}（${item.mass}）`;
      preset.appendChild(option);
    });
    document.querySelectorAll(".ws-inputs input, .ws-solvent input").forEach((input) => {
      input.addEventListener("input", compute);
    });
    $("addSalt").addEventListener("click", addSalt);
    $("saveRecipe").addEventListener("click", () => {
      const name = window.prompt("配方名称", "FAI/PbI2 基础配方");
      if (!name) return;
      const recipes = savedList();
      recipes[name.trim()] = recipeSnapshot();
      localStorage.setItem("labdesk.recipes", JSON.stringify(recipes));
      refreshSaved(name.trim());
    });
    $("loadRecipe").addEventListener("click", () => {
      const name = $("savedRecipes").value;
      if (!name) return;
      applyRecipe(savedList()[name]);
    });
    $("exportCsv").addEventListener("click", exportCsv);
    $("printPage").addEventListener("click", () => window.print());
    refreshSaved();
    renderSalts();
    compute();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
