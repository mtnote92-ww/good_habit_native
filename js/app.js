/* ==========================================================================
   Good-Habits — アプリの起動・画面遷移・イベント配線
   ========================================================================== */

(function () {
  var STORAGE = window.GH_STORAGE;
  var CONTENT = window.GH_CONTENT;
  var LOGIC = window.GH_LOGIC;
  var UI = window.GH_UI;
  var el = UI.el;

  var state = STORAGE.load();
  var currentMessage = null;
  var selectedBadgeId = null;
  var heatmapYear, heatmapMonth;
  var activeScreen = null;

  function persist() { STORAGE.save(state); }

  function goTo(name) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    var target = el("screen-" + name);
    if (!target) return;
    target.classList.add("active");
    activeScreen = name;

    if (name === "home") UI.renderHome(state, currentMessage);
    if (name === "add") UI.resetAddScreen();
    if (name === "badges") UI.renderBadges(state);
    if (name === "badge-detail" && selectedBadgeId) UI.renderBadgeDetail(state, selectedBadgeId);
    if (name === "heatmap") UI.renderHeatmap(state, heatmapYear, heatmapMonth);
    if (name === "settings") UI.renderSettings(state);
  }

  function initHeatmapDate() {
    var d = new Date();
    heatmapYear = d.getFullYear();
    heatmapMonth = d.getMonth();
  }

  // ---- データのバックアップ --------------------------------------------------

  function backupFilename() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return "good-habits-backup-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ".json";
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function restoreFromText(text) {
    var next;
    try {
      next = STORAGE.parseBackup(text);
    } catch (e) {
      UI.showToast("復元できませんでした：" + e.message);
      return;
    }
    if (!window.confirm(
      "現在のデータを、バックアップの内容で置き換えます。\n（習慣 " + next.habits.length + " 件）\nこの操作は取り消せません。よろしいですか？"
    )) return;
    STORAGE.save(next);
    location.reload();
  }

  // ---- クリックイベントの一括委譲 -------------------------------------------

  document.addEventListener("click", function (e) {
    var navBtn = e.target.closest("[data-nav-target]");
    if (navBtn) { goTo(navBtn.getAttribute("data-nav-target")); return; }

    var removeBtn = e.target.closest('[data-action="remove-habit"]');
    if (removeBtn) {
      var rid = Number(removeBtn.getAttribute("data-habit-id"));
      var habit = state.habits.filter(function (h) { return h.id === rid; })[0];
      var ok = window.confirm('「' + (habit ? habit.name : "この習慣") + '」の記録を削除します。よろしいですか？');
      if (ok) {
        LOGIC.removeHabit(state, rid);
        persist();
        UI.renderHome(state, currentMessage);
        syncSkippedNotifications();
      }
      return;
    }

    var editBtn = e.target.closest('[data-action="edit-habit"]');
    if (editBtn) {
      var eid = Number(editBtn.getAttribute("data-habit-id"));
      var editHabit = state.habits.filter(function (h) { return h.id === eid; })[0];
      if (editHabit) {
        goTo("add");
        UI.setupEditScreen(editHabit);
      }
      return;
    }

    var moveUpBtn = e.target.closest('[data-action="move-habit-up"]');
    if (moveUpBtn) {
      var upId = Number(moveUpBtn.getAttribute("data-habit-id"));
      if (LOGIC.moveHabit(state, upId, -1)) {
        persist();
        UI.renderHome(state, currentMessage);
      }
      return;
    }

    var moveDownBtn = e.target.closest('[data-action="move-habit-down"]');
    if (moveDownBtn) {
      var downId = Number(moveDownBtn.getAttribute("data-habit-id"));
      if (LOGIC.moveHabit(state, downId, 1)) {
        persist();
        UI.renderHome(state, currentMessage);
      }
      return;
    }

    var toggleBtn = e.target.closest('[data-action="toggle-habit"]');
    if (toggleBtn) {
      var hid = Number(toggleBtn.getAttribute("data-habit-id"));
      var result = LOGIC.toggleHabitDone(state, hid, new Date());
      if (result.changed) {
        persist();
        UI.renderHome(state, currentMessage);
        syncSkippedNotifications();
        if (result.achieved) {
          UI.showCelebration(result.achieved, result.newlyEarnedBadges);
        } else if (result.done) {
          UI.showToast(CONTENT.randomPraise());
        }
      }
      return;
    }

    var catBtn = e.target.closest("[data-category]");
    if (catBtn) {
      UI.setAddSelectedCategory(catBtn.getAttribute("data-category"));
      UI.renderAddOptions();
      UI.updateAddSubmitState();
      return;
    }

    var badgeTile = e.target.closest("[data-badge-id]");
    if (badgeTile) {
      selectedBadgeId = badgeTile.getAttribute("data-badge-id");
      goTo("badge-detail");
      return;
    }

    var themeChoice = e.target.closest("[data-theme-choice]");
    if (themeChoice) {
      state.settings.theme = themeChoice.getAttribute("data-theme-choice");
      persist();
      UI.applyTheme(state.settings.theme);
      UI.renderSettings(state);
      return;
    }

    var hourChoice = e.target.closest("[data-reset-hour]");
    if (hourChoice) {
      state.settings.resetHour = Number(hourChoice.getAttribute("data-reset-hour"));
      persist();
      UI.renderSettings(state);
      syncSkippedNotifications();
      armDayChangeTimer();
      return;
    }

    var toggleKey = e.target.closest("[data-toggle-key]");
    if (toggleKey) {
      var key = toggleKey.getAttribute("data-toggle-key");
      state.settings[key] = !state.settings[key];
      persist();
      UI.renderSettings(state);
      if (key === "notifySkipped") {
        syncSkippedNotifications();
        requestNotificationPermissionIfUndecided();
      }
      return;
    }

    if (e.target.closest('[data-action="export-data"]')) {
      downloadText(backupFilename(), STORAGE.serialize(state));
      UI.showToast("バックアップを書き出しました。");
      return;
    }

    if (e.target.closest('[data-action="copy-data"]')) {
      var json = STORAGE.serialize(state);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(
          function () { UI.showToast("バックアップをコピーしました。メモやメールに貼り付けて保管してください。"); },
          function () { window.prompt("下のテキストをすべてコピーして保管してください。", json); }
        );
      } else {
        window.prompt("下のテキストをすべてコピーして保管してください。", json);
      }
      return;
    }

    if (e.target.closest('[data-action="paste-restore"]')) {
      var pasted = window.prompt("バックアップのテキストを貼り付けてください。");
      if (pasted) restoreFromText(pasted);
      return;
    }
  });

  // ---- 変更イベント（ファイル選択）の委譲 -----------------------------------

  document.addEventListener("change", function (e) {
    var fileInput = e.target.closest('[data-action="import-file"]');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { restoreFromText(String(reader.result)); };
      reader.onerror = function () { UI.showToast("ファイルを読み込めませんでした。"); };
      reader.readAsText(fileInput.files[0]);
      fileInput.value = "";
    }
  });

  // ---- 個別要素のイベント ----------------------------------------------------

  el("fab-add").addEventListener("click", function () { goTo("add"); });
  el("add-back").addEventListener("click", function () { goTo("home"); });
  el("add-name-input").addEventListener("input", UI.updateAddSubmitState);
  el("add-submit").addEventListener("click", function () {
    var name = el("add-name-input").value.trim();
    var editingId = UI.getEditingHabitId();
    if (editingId !== null) {
      if (!name) return;
      if (LOGIC.renameHabit(state, editingId, name)) {
        persist();
        syncSkippedNotifications();
      }
      goTo("home");
      return;
    }
    var cat = UI.getAddSelectedCategory();
    if (!name || !cat) return;
    LOGIC.addHabit(state, name, cat);
    persist();
    goTo("home");
    syncSkippedNotifications();
    requestNotificationPermissionIfUndecided();
  });

  el("badge-detail-back").addEventListener("click", function () { goTo("badges"); });

  el("month-prev").addEventListener("click", function () {
    heatmapMonth--;
    if (heatmapMonth < 0) { heatmapMonth = 11; heatmapYear--; }
    UI.renderHeatmap(state, heatmapYear, heatmapMonth);
  });
  el("month-next").addEventListener("click", function () {
    heatmapMonth++;
    if (heatmapMonth > 11) { heatmapMonth = 0; heatmapYear++; }
    UI.renderHeatmap(state, heatmapYear, heatmapMonth);
  });

  el("skipped-banner-close").addEventListener("click", function () {
    state.meta.skippedBannerPending = false;
    persist();
    UI.renderHome(state, currentMessage);
  });

  el("celebration-close").addEventListener("click", UI.hideCelebration);
  el("celebration-view-badges").addEventListener("click", function () {
    UI.hideCelebration();
    goTo("badges");
  });

  // ---- OS通知（前日サボった場合の翌日リマインド） ------------------------------
  // @capacitor/local-notifications によるローカル通知（サーバー不要）で実現する。
  // アプリを開かない日にも届くよう、「このまま今日が終わるとサボり扱いになる習慣」があれば
  // 明日の分を前もって予約しておく。予約は state から毎回計算し直す（syncSkippedNotifications）。

  var SKIPPED_NOTIFICATION_HOURS = [10, 12, 21];
  var TODAY_NOTIFICATION_ID_BASE = 9001;    // 9001〜9003: 今日（前日サボった分）
  var TOMORROW_NOTIFICATION_ID_BASE = 9004; // 9004〜9006: 明日（今日サボりそうな分）
  var SKIPPED_NOTIFICATION_NAMES_SHOWN = 2;

  function getLocalNotifications() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
  }

  function formatSkippedHabitNames(names) {
    var shown = names.slice(0, SKIPPED_NOTIFICATION_NAMES_SHOWN)
      .map(function (n) { return "「" + n + "」"; })
      .join("");
    if (names.length > SKIPPED_NOTIFICATION_NAMES_SHOWN) shown += "など";
    return shown;
  }

  function buildSkippedNotificationMessage(skippedHabitNames) {
    return "昨日はお疲れさまでした。" + formatSkippedHabitNames(skippedHabitNames) + "が未達成でしたが、今日再開すれば習慣化につながります！";
  }

  function allSkippedNotificationIds() {
    var ids = [];
    SKIPPED_NOTIFICATION_HOURS.forEach(function (_, i) {
      ids.push({ id: TODAY_NOTIFICATION_ID_BASE + i }, { id: TOMORROW_NOTIFICATION_ID_BASE + i });
    });
    return ids;
  }

  // アプリ日 dayKey の hour 時。リスト更新時刻は 0〜4 時なので、10時以降はカレンダー上も同じ日付になる。
  function dayKeyAtHour(dayKey, hour) {
    var p = dayKey.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2], hour, 0, 0, 0);
  }

  // 「10時ごろ」に届けば十分なので、正確な時刻のアラーム（SCHEDULE_EXACT_ALARM）は使わない。
  // isExactNotification を省くと、プラグインが予約のたびに「アラームとリマインダー」の設定画面を開いてしまう。
  // allowWhileIdle で、端末の省電力（Doze）中でも遅れすぎずに届くようにする。
  function buildDayNotifications(idBase, dayKey, names, now) {
    var body = buildSkippedNotificationMessage(names);
    return SKIPPED_NOTIFICATION_HOURS.map(function (hour, i) {
      return {
        id: idBase + i,
        title: "Good-Habits",
        body: body,
        largeBody: body, // 展開したときに全文が読めるようにする（body だけだと1行で切れる）
        schedule: { at: dayKeyAtHour(dayKey, hour), allowWhileIdle: true },
        isExactNotification: false
      };
    }).filter(function (n) { return n.schedule.at.getTime() > now.getTime(); });
  }

  // state から「今あるべき予約」を計算する
  function plannedSkippedNotifications(now) {
    if (!state.settings.notifySkipped) return [];
    var today = LOGIC.todayKey(state, now);
    var planned = [];

    var notice = state.meta.skippedNotice;
    if (notice && notice.day === today && notice.names.length && !LOGIC.allDoneToday(state)) {
      planned = planned.concat(buildDayNotifications(TODAY_NOTIFICATION_ID_BASE, today, notice.names, now));
    }

    var atRisk = LOGIC.atRiskHabitNames(state);
    if (atRisk.length) {
      planned = planned.concat(buildDayNotifications(TOMORROW_NOTIFICATION_ID_BASE, STORAGE.addDays(today, 1), atRisk, now));
    }
    return planned;
  }

  // 連打などで取り消しと予約が入れ違わないよう、同期処理は1本の Promise チェーンで直列に実行する
  var notificationSyncChain = Promise.resolve();

  // 通知の予約を state に合わせて作り直す。権限は確認するだけで、ダイアログは出さない。
  function syncSkippedNotifications() {
    var LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) return;

    notificationSyncChain = notificationSyncChain.then(function () {
      return LocalNotifications.cancel({ notifications: allSkippedNotificationIds() }).catch(function () {});
    }).then(function () {
      var planned = plannedSkippedNotifications(new Date());
      if (!planned.length) return null;
      return LocalNotifications.checkPermissions().then(function (result) {
        if (result.display !== "granted") return null;
        return LocalNotifications.schedule({ notifications: planned });
      });
    }).catch(function (err) {
      console.warn("Good-Habits: OS通知のスケジュールに失敗しました。", err);
    });
  }

  // 通知の許可がまだ決まっていなければダイアログを出す（習慣の追加時・通知設定をオンにしたときに呼ぶ）
  function requestNotificationPermissionIfUndecided() {
    var LocalNotifications = getLocalNotifications();
    if (!LocalNotifications || !state.settings.notifySkipped) return;

    LocalNotifications.checkPermissions().then(function (result) {
      if (result.display === "granted" || result.display === "denied") return null;
      return LocalNotifications.requestPermissions().then(function (requested) {
        if (requested.display === "granted") syncSkippedNotifications();
      });
    }).catch(function (err) {
      console.warn("Good-Habits: 通知の許可の確認に失敗しました。", err);
    });
  }

  // ---- 日付の切り替わり（起動中・復帰時） --------------------------------------

  var dayChangeTimer = null;

  // 次の「リスト更新時刻」に日付の切り替わりを処理するタイマーを仕掛け直す
  function armDayChangeTimer() {
    if (dayChangeTimer) clearTimeout(dayChangeTimer);
    var now = new Date();
    var nextDay = STORAGE.addDays(LOGIC.todayKey(state, now), 1);
    var delay = dayKeyAtHour(nextDay, state.settings.resetHour).getTime() - now.getTime();
    dayChangeTimer = setTimeout(handleDayChange, Math.max(delay, 0) + 1000);
  }

  // アプリを開いたまま日付をまたいだ場合も、起動時と同じロールオーバーを行う
  function handleDayChange() {
    var rollover = LOGIC.runRollover(state, new Date());
    if (rollover.rolled) {
      currentMessage = CONTENT.randomMessage();
      persist();
      // 追加画面は入力途中の内容が消えるので描画し直さない（ホームに戻ったときに反映される）
      if (activeScreen && activeScreen !== "add") goTo(activeScreen);
    }
    syncSkippedNotifications();
    armDayChangeTimer();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") handleDayChange();
  });

  // ---- 起動 -------------------------------------------------------------------

  function boot() {
    UI.initNavbars();
    UI.applyTheme(state.settings.theme);
    initHeatmapDate();

    LOGIC.runRollover(state, new Date());
    currentMessage = CONTENT.randomMessage();
    persist();

    syncSkippedNotifications();
    armDayChangeTimer();

    goTo("home");
  }

  boot();
})();
