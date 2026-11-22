(function () {
  "use strict";

  var characters = {
    warrior: {
      key: "warrior",
      name: "전사",
      english: "WARRIOR",
      sigil: "W",
      maxHp: 160,
      maxMp: 30,
      attack: 24,
      skillName: "강타",
      skillDamage: 48,
      skillCost: 10
    },
    mage: {
      key: "mage",
      name: "마법사",
      english: "MAGE",
      sigil: "M",
      maxHp: 110,
      maxMp: 60,
      attack: 16,
      skillName: "화염구",
      skillDamage: 56,
      skillCost: 12
    }
  };

  var monsters = [
    { name: "슬라임", sigil: "SLM", subtitle: "THE FIRST TRIAL", maxHp: 60, attack: 9 },
    { name: "고블린", sigil: "GOB", subtitle: "THE CUNNING RAID", maxHp: 100, attack: 15 },
    { name: "드래곤", sigil: "DRG", subtitle: "THE FINAL ENCOUNTER", maxHp: 180, attack: 24 }
  ];

  var game = {
    classKey: "warrior",
    player: null,
    monster: null,
    stage: 0,
    turn: 1,
    status: "home",
    busy: false,
    runId: 0
  };

  var pendingGameTimers = [];
  var animationTimers = new Map();

  var screens = {
    home: document.getElementById("screen-home"),
    select: document.getElementById("screen-select"),
    battle: document.getElementById("screen-battle"),
    result: document.getElementById("screen-result")
  };

  var actionButtons = Array.prototype.slice.call(document.querySelectorAll("[data-action]"));
  var battleLog = document.getElementById("battle-log");
  var feedback = document.getElementById("action-feedback");
  var stageModal = document.getElementById("stage-modal");
  var guideDialog = document.getElementById("guide-dialog");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = key !== name;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function invalidateRun() {
    game.runId += 1;
    pendingGameTimers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });
    pendingGameTimers = [];
    animationTimers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });
    animationTimers.clear();
  }

  function scheduleGameTask(callback, delay) {
    var scheduledRunId = game.runId;
    var timerId = window.setTimeout(function () {
      pendingGameTimers = pendingGameTimers.filter(function (pendingId) {
        return pendingId !== timerId;
      });
      if (scheduledRunId !== game.runId) return;
      callback();
    }, delay);
    pendingGameTimers.push(timerId);
  }

  function openStageModal() {
    if (typeof stageModal.showModal === "function") {
      if (!stageModal.open) stageModal.showModal();
    } else {
      stageModal.setAttribute("open", "");
    }
  }

  function closeStageModal() {
    if (typeof stageModal.close === "function") {
      if (stageModal.open) stageModal.close();
    } else {
      stageModal.removeAttribute("open");
    }
  }

  function goHome(event) {
    if (event) event.preventDefault();
    invalidateRun();
    game.status = "home";
    game.busy = false;
    closeStageModal();
    setBusy(false);
    showScreen("home");
    document.getElementById("start-button").focus({ preventScroll: true });
  }

  function openSelection() {
    invalidateRun();
    game.status = "select";
    showScreen("select");
    var selected = document.querySelector('input[name="character"]:checked');
    if (selected) selected.focus({ preventScroll: true });
  }

  function clonePlayer(classKey) {
    var source = characters[classKey];
    return {
      key: source.key,
      name: source.name,
      english: source.english,
      sigil: source.sigil,
      maxHp: source.maxHp,
      maxMp: source.maxMp,
      hp: source.maxHp,
      mp: source.maxMp,
      attack: source.attack,
      skillName: source.skillName,
      skillDamage: source.skillDamage,
      skillCost: source.skillCost,
      potions: 3
    };
  }

  function cloneMonster(index) {
    var source = monsters[index];
    return {
      name: source.name,
      sigil: source.sigil,
      subtitle: source.subtitle,
      maxHp: source.maxHp,
      hp: source.maxHp,
      attack: source.attack
    };
  }

  function startGame(classKey) {
    invalidateRun();
    game.classKey = classKey;
    game.player = clonePlayer(classKey);
    game.stage = 0;
    game.turn = 1;
    game.monster = cloneMonster(0);
    game.status = "battle";
    game.busy = false;
    closeStageModal();
    battleLog.innerHTML = "";
    setFeedback("행동을 선택해 첫 번째 전투를 시작하세요.", "");
    addLog("system", "슬라임 등장! 1단계 전투가 시작되었습니다.");
    showScreen("battle");
    renderBattle();
    actionButtons[0].focus({ preventScroll: true });
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function setMeter(selector, current, maximum) {
    var meter = document.querySelector(selector);
    if (!meter) return;
    var safeMaximum = Math.max(1, maximum);
    var percent = Math.max(0, Math.min(100, (current / safeMaximum) * 100));
    var fill = meter.querySelector("span");
    fill.style.width = percent + "%";
    meter.setAttribute("aria-valuemax", String(maximum));
    meter.setAttribute("aria-valuenow", String(current));
  }

  function renderBattle() {
    if (!game.player || !game.monster) return;

    setText("stage-number", game.stage + 1);
    setText("battle-monster-name", game.monster.name);
    setText("turn-number", pad(game.turn));

    setText("monster-attack-label", "ATK " + game.monster.attack);
    setText("monster-sigil", game.monster.sigil);
    setText("monster-subtitle", game.monster.subtitle);
    setText("monster-name", game.monster.name);
    setText("monster-hp", game.monster.hp);
    setText("monster-max-hp", game.monster.maxHp);
    setMeter(".enemy-track", game.monster.hp, game.monster.maxHp);

    setText("player-sigil", game.player.sigil);
    setText("player-subtitle", game.player.english);
    setText("player-name", game.player.name);
    setText("player-hp", game.player.hp);
    setText("player-max-hp", game.player.maxHp);
    setText("player-mp", game.player.mp);
    setText("player-max-mp", game.player.maxMp);
    setMeter(".hp-track", game.player.hp, game.player.maxHp);
    setMeter(".mp-track", game.player.mp, game.player.maxMp);

    setText("potion-count", game.player.potions);
    setText("action-potions", game.player.potions);
    setText("attack-damage", game.player.attack);
    setText("skill-name", game.player.skillName);
    setText("skill-damage", game.player.skillDamage);
    setText("skill-cost", game.player.skillCost);

    var skillButton = document.querySelector('[data-action="skill"]');
    var potionButton = document.querySelector('[data-action="potion"]');
    skillButton.dataset.unavailable = String(game.player.mp < game.player.skillCost);
    potionButton.dataset.unavailable = String(game.player.potions < 1 || game.player.hp >= game.player.maxHp);

    var stageSteps = document.querySelectorAll("[data-stage-step]");
    Array.prototype.forEach.call(stageSteps, function (step, index) {
      step.classList.toggle("is-current", index === game.stage);
      step.classList.toggle("is-complete", index < game.stage);
      if (index === game.stage) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      var circle = step.querySelector(":scope > span");
      circle.textContent = index < game.stage ? "✓" : String(index + 1);
    });
  }

  function setFeedback(message, tone) {
    feedback.textContent = message;
    feedback.classList.remove("is-warning", "is-success");
    if (tone) feedback.classList.add("is-" + tone);
  }

  function addLog(type, message) {
    var item = document.createElement("li");
    item.dataset.type = type;
    var time = document.createElement("time");
    time.textContent = "턴 " + pad(game.turn);
    var copy = document.createElement("span");
    copy.textContent = message;
    item.appendChild(time);
    item.appendChild(copy);
    battleLog.appendChild(item);
    while (battleLog.children.length > 60) battleLog.removeChild(battleLog.firstElementChild);
    battleLog.scrollTop = battleLog.scrollHeight;
  }

  function setBusy(value) {
    game.busy = value;
    actionButtons.forEach(function (button) {
      button.disabled = value;
    });
    var panel = document.querySelector(".action-panel");
    if (panel) panel.setAttribute("aria-busy", String(value));
  }

  function animateCard(id, className) {
    var card = document.getElementById(id);
    if (!card) return;
    var previousTimer = animationTimers.get(card);
    if (previousTimer) window.clearTimeout(previousTimer);
    card.classList.remove(className);
    void card.offsetWidth;
    card.classList.add(className);
    var timerId = window.setTimeout(function () {
      if (animationTimers.get(card) !== timerId) return;
      card.classList.remove(className);
      animationTimers.delete(card);
    }, 480);
    animationTimers.set(card, timerId);
  }

  function failAction(message) {
    setFeedback(message + " 턴은 유지됩니다.", "warning");
    addLog("system", message + " 턴을 소비하지 않습니다.");
    renderBattle();
  }

  function performAction(action) {
    if (game.status !== "battle" || game.busy || !game.player || !game.monster) return;

    var defended = false;
    var damage = 0;
    var actual = 0;

    if (action === "attack") {
      damage = game.player.attack;
      actual = Math.min(game.monster.hp, damage);
      game.monster.hp -= actual;
      addLog("player", "일반 공격! " + game.monster.name + "에게 " + actual + "의 피해를 입혔습니다.");
      setFeedback("일반 공격으로 " + actual + " 피해를 입혔습니다.", "success");
      animateCard("monster-card", "shake");
    } else if (action === "skill") {
      if (game.player.mp < game.player.skillCost) {
        failAction("MP가 부족합니다.");
        return;
      }
      game.player.mp -= game.player.skillCost;
      damage = game.player.skillDamage;
      actual = Math.min(game.monster.hp, damage);
      game.monster.hp -= actual;
      addLog("player", game.player.skillName + "! MP " + game.player.skillCost + " 소모, " + game.monster.name + "에게 " + actual + "의 피해를 입혔습니다.");
      setFeedback(game.player.skillName + "로 " + actual + " 피해를 입혔습니다.", "success");
      animateCard("monster-card", "flash-skill");
    } else if (action === "defend") {
      defended = true;
      addLog("player", "방어 자세! 이번 몬스터 공격의 피해가 절반으로 감소합니다.");
      setFeedback("방어 자세를 취했습니다. 이어지는 반격 피해가 절반이 됩니다.", "success");
    } else if (action === "potion") {
      if (game.player.potions < 1) {
        failAction("포션이 없습니다.");
        return;
      }
      if (game.player.hp >= game.player.maxHp) {
        failAction("HP가 이미 가득 찼습니다.");
        return;
      }
      var recovered = Math.min(50, game.player.maxHp - game.player.hp);
      game.player.hp += recovered;
      game.player.potions -= 1;
      addLog("heal", "포션 사용! HP " + recovered + " 회복, 남은 포션 " + game.player.potions + "개.");
      setFeedback("포션으로 HP를 " + recovered + " 회복했습니다.", "success");
      animateCard("player-card", "pulse-heal");
    } else {
      return;
    }

    setBusy(true);
    renderBattle();

    if (game.monster.hp <= 0) {
      scheduleGameTask(handleVictory, 280);
      return;
    }

    scheduleGameTask(function () {
      counterAttack(defended);
    }, 260);
  }

  function counterAttack(defended) {
    var incoming = defended ? Math.max(1, Math.floor(game.monster.attack / 2)) : game.monster.attack;
    var actual = Math.min(game.player.hp, incoming);
    game.player.hp -= actual;
    addLog("enemy", game.monster.name + "의 반격! " + game.player.name + "가 " + actual + "의 피해를 받았습니다" + (defended ? " (방어 적용)." : "."));
    animateCard("player-card", "shake");
    renderBattle();

    if (game.player.hp <= 0) {
      setFeedback(game.monster.name + "의 반격으로 쓰러졌습니다.", "warning");
      scheduleGameTask(function () {
        showResult(false);
      }, 360);
      return;
    }

    game.turn += 1;
    renderBattle();
    setBusy(false);
  }

  function handleVictory() {
    addLog("system", game.monster.name + " 처치! 몬스터 HP: 0 / " + game.monster.maxHp + ".");
    renderBattle();

    if (game.stage === monsters.length - 1) {
      setFeedback("마지막 드래곤을 처치했습니다!", "success");
      scheduleGameTask(function () {
        showResult(true);
      }, 380);
      return;
    }

    var hpReward = Math.min(30, game.player.maxHp - game.player.hp);
    var mpReward = Math.min(15, game.player.maxMp - game.player.mp);
    game.player.hp += hpReward;
    game.player.mp += mpReward;
    game.status = "stage-clear";
    setBusy(false);
    renderBattle();

    setText("stage-modal-title", game.monster.name + " 처치!");
    setText("reward-hp", "+" + hpReward);
    setText("reward-mp", "+" + mpReward);
    openStageModal();
    document.getElementById("next-stage").focus({ preventScroll: true });
  }

  function nextStage() {
    if (game.status !== "stage-clear") return;
    game.stage += 1;
    game.turn = 1;
    game.monster = cloneMonster(game.stage);
    game.status = "battle";
    game.busy = false;
    closeStageModal();
    battleLog.innerHTML = "";
    addLog("system", (game.stage + 1) + "단계 시작! " + game.monster.name + " 등장!");
    setFeedback("새로운 전투가 시작되었습니다.", "");
    renderBattle();
    actionButtons[0].focus({ preventScroll: true });
  }

  function showResult(victory) {
    game.status = victory ? "victory" : "defeat";
    game.busy = false;
    setBusy(false);
    closeStageModal();

    setText("result-kicker", victory ? "ADVENTURE COMPLETE" : "ADVENTURE FAILED");
    setText("result-title", victory ? "모든 몬스터를 처치했습니다!" : game.monster.name + "에게 패배했습니다.");
    setText(
      "result-description",
      victory
        ? "세 번의 전투를 통과하고 왕국의 평화를 되찾았습니다."
        : "HP가 0이 되었습니다. 전술을 바꾸어 다시 도전해보세요."
    );
    setText("result-class", game.player.name);
    setText("result-hp", game.player.hp);
    setText("result-max-hp", game.player.maxHp);
    setText("result-potions", game.player.potions);
    setText("result-stage", (game.stage + 1) + " / 3");

    var emblem = document.getElementById("result-emblem");
    emblem.textContent = victory ? "V" : "×";
    emblem.classList.toggle("is-defeat", !victory);

    showScreen("result");
    var resultTitle = document.getElementById("result-title");
    resultTitle.setAttribute("tabindex", "-1");
    resultTitle.focus({ preventScroll: true });
  }

  function openGuide() {
    if (typeof guideDialog.showModal === "function") guideDialog.showModal();
    else guideDialog.setAttribute("open", "");
  }

  function closeGuide() {
    if (typeof guideDialog.close === "function") guideDialog.close();
    else guideDialog.removeAttribute("open");
  }

  document.getElementById("start-button").addEventListener("click", openSelection);

  document.getElementById("confirm-character").addEventListener("click", function () {
    var selected = document.querySelector('input[name="character"]:checked');
    startGame(selected ? selected.value : "warrior");
  });

  actionButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      performAction(button.dataset.action);
    });
  });

  document.getElementById("next-stage").addEventListener("click", nextStage);
  document.getElementById("restart-same").addEventListener("click", function () {
    startGame(game.classKey);
  });
  document.getElementById("change-class").addEventListener("click", openSelection);

  Array.prototype.forEach.call(document.querySelectorAll("[data-go-home]"), function (button) {
    button.addEventListener("click", goHome);
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-open-guide]"), function (button) {
    button.addEventListener("click", openGuide);
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-close-guide]"), function (button) {
    button.addEventListener("click", closeGuide);
  });

  guideDialog.addEventListener("click", function (event) {
    if (event.target === guideDialog) closeGuide();
  });

  stageModal.addEventListener("cancel", function (event) {
    event.preventDefault();
  });

  document.addEventListener("keydown", function (event) {
    if (game.status !== "battle" || game.busy || guideDialog.open || stageModal.open) return;
    var actionByKey = { "1": "attack", "2": "skill", "3": "defend", "4": "potion" };
    var action = actionByKey[event.key];
    if (action) {
      event.preventDefault();
      performAction(action);
    }
  });
})();

