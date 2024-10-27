// Create Alarm and Handle Reminders
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'createAlarm') {
        const task = message.task;
        const timeUntilDeadline = new Date(task.deadline).getTime() - Date.now();

        if (timeUntilDeadline > 0) {
            createReminders(task.id, timeUntilDeadline);
        }
    }

    if (message.type === 'removeAlarm') {
        for (let i = 1; i <= 3; i++) {
            chrome.alarms.clear(`reminder-${message.taskId}-${i}`);
        }
    }

    if (message.type === 'showNotification') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.jpeg',
            title: message.title,
            message: message.message,
            priority: 2
        });
    }
});

// Helper function to create reminders
function createReminders(taskId, timeUntilDeadline) {
    for (let i = 1; i <= 3; i++) {
        chrome.alarms.create(`reminder-${taskId}-${i}`, {
            when: Date.now() + timeUntilDeadline + (i - 1) * 60000,
            periodInMinutes: 0
        });
    }
}

// Handle Alarm Notifications
chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name.startsWith('reminder-')) {
        const [_, taskId, reminderCount] = alarm.name.split('-');
        chrome.storage.local.get(['tasks'], function (data) {
            const task = (data.tasks || []).find(t => t.id == taskId);
            if (task) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon.jpeg',
                    title: 'Task Reminder',
                    message: `Reminder: ${task.description} is due soon! Click to view.`,
                    priority: 2
                });

                if (reminderCount === '1') {
                    moveTaskToPending(task);
                }
            }
        });
    }
});

// Move Task to Pending List after Reminder
function moveTaskToPending(task) {
    chrome.storage.local.get(['tasks', 'pendingTasks'], function (data) {
        const tasks = (data.tasks || []).filter(t => t.id !== task.id);
        const pendingTasks = data.pendingTasks || [];
        pendingTasks.push(task);

        // Save updated tasks and pending tasks
        chrome.storage.local.set({ tasks, pendingTasks }, () => {
            // Notify the popup to refresh the lists if it's open
            chrome.runtime.sendMessage({ type: 'refreshLists' });
        });
    });
}

// Open popup on action icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
