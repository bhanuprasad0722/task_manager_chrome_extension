document.addEventListener('DOMContentLoaded', function () {
    const taskInput = document.getElementById('taskInput');
    const taskDeadline = document.getElementById('taskDeadline');
    const taskURL = document.getElementById('taskURL');
    const addTaskButton = document.getElementById('addTaskButton');
    const todoList = document.getElementById('todoList');
    const pendingList = document.getElementById('pendingList'); // New Pending List
    const doneList = document.getElementById('doneList');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const clearAllButton = document.getElementById('clearAllButton'); // Clear All Button for completed tasks

    // Welcome Message based on time of day
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
        welcomeMessage.textContent = "Good morning! Ready to tackle your tasks today?";
    } else if (currentHour < 18) {
        welcomeMessage.textContent = "Good afternoon! Keep pushing through your tasks!";
    } else {
        welcomeMessage.textContent = "Good evening! Let's wrap up the day with your tasks.";
    }

    // Load saved tasks from chrome.storage
    chrome.storage.local.get(['tasks', 'pendingTasks', 'completedTasks'], function (data) {
        const savedTasks = data.tasks || [];
        const pendingTasks = data.pendingTasks || [];
        const completedTasks = data.completedTasks || [];

        savedTasks.forEach((task) => {
            createTaskElement(task);
        });

        pendingTasks.forEach((task) => {
            createPendingTaskElement(task);
        });

        updateRecentTasks(completedTasks);
    });

    // Add Task Functionality
    addTaskButton.addEventListener('click', function () {
        const taskDescription = taskInput.value;
        const deadline = new Date(taskDeadline.value);
        const url = taskURL.value;
        const taskId = new Date().getTime();

        if (taskDescription && taskDeadline.value) {
            const task = { id: taskId, description: taskDescription, deadline: deadline.toISOString(), url: url };

            // Save the task to chrome.storage
            chrome.storage.local.get('tasks', function (data) {
                const tasks = data.tasks || [];
                tasks.push(task);
                chrome.storage.local.set({ tasks: tasks });

                // Set alarm for this task
                chrome.runtime.sendMessage({ type: 'createAlarm', task: task });

                // Create task element in the UI
                createTaskElement(task);
            });

            // Show notification
            chrome.runtime.sendMessage({ type: 'showNotification', title: 'Task Added', message: `${taskDescription} has been added.` });

            // Clear input fields
            taskInput.value = '';
            taskDeadline.value = '';
            taskURL.value = '';
        } else {
            alert("Please fill in both task description and deadline.");
        }
    });

    // Create Task Element in the To-Do List
    function createTaskElement(task) {
        const todoItem = document.createElement('li');
        const deadline = new Date(task.deadline).toLocaleString();
        todoItem.textContent = `${task.description} - Due: ${deadline}`;

        if (task.url) {
            const link = document.createElement('a');
            link.href = task.url;
            link.textContent = ' (Open Task)';
            link.target = '_blank';
            todoItem.appendChild(link);
        }

        // Add buttons
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function () {
            removeTask(task.id, todoItem);
        };

        const moveButton = document.createElement('button');
        moveButton.textContent = 'Move to Done';
        moveButton.onclick = function () {
            moveTaskToDone(task, todoItem);
        };

        todoItem.appendChild(deleteButton);
        todoItem.appendChild(moveButton);
        todoList.appendChild(todoItem);
    }

    // Create Pending Task Element
    function createPendingTaskElement(task) {
        const pendingItem = document.createElement('li');
        const deadline = new Date(task.deadline).toLocaleString();
        pendingItem.textContent = `${task.description} - Pending - Due: ${deadline}`;

        if (task.url) {
            const link = document.createElement('a');
            link.href = task.url;
            link.textContent = ' (Open Task)';
            link.target = '_blank';
            pendingItem.appendChild(link);
        }

        // Add Delete and Move to Done buttons for pending task
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function () {
            removeTaskFromPending(task.id, pendingItem);
        };

        const moveToDoneButton = document.createElement('button');
        moveToDoneButton.textContent = 'Move to Done';
        moveToDoneButton.onclick = function () {
            moveTaskToDone(task, pendingItem);
        };

        pendingItem.appendChild(deleteButton);
        pendingItem.appendChild(moveToDoneButton);
        pendingList.appendChild(pendingItem);
    }

    // Move Task to Done List
    function moveTaskToDone(task, todoItem) {
        chrome.storage.local.get(['tasks', 'completedTasks'], function (data) {
            const tasks = data.tasks.filter((t) => t.id !== task.id);
            const completedTasks = data.completedTasks || [];
            completedTasks.unshift(task); // Add task to the beginning of completed tasks

            // Save updated tasks and completed tasks
            chrome.storage.local.set({ tasks: tasks, completedTasks: completedTasks.slice(0, 5) }); // Keep only top 5

            updateRecentTasks(completedTasks.slice(0, 5));

            // Remove task from To-Do List
            todoList.removeChild(todoItem);

            // Remove the alarm associated with this task
            chrome.runtime.sendMessage({ type: 'removeAlarm', taskId: task.id });

            // Show notification
            chrome.runtime.sendMessage({ type: 'showNotification', title: 'Task Completed', message: `${task.description} has been moved to done.` });
        });
    }

    // Move Task to Pending List after Reminder
    function moveTaskToPending(task) {
        chrome.storage.local.get(['tasks', 'pendingTasks'], function (data) {
            const tasks = data.tasks.filter((t) => t.id !== task.id);
            const pendingTasks = data.pendingTasks || [];
            pendingTasks.push(task);

            // Save updated tasks and pending tasks
            chrome.storage.local.set({ tasks: tasks, pendingTasks: pendingTasks });

            // Create Pending Task in UI
            createPendingTaskElement(task);

            // Show notification
            chrome.runtime.sendMessage({ type: 'showNotification', title: 'Task Moved to Pending', message: `${task.description} has been moved to Pending.` });
        });
    }

    // Remove Task from Pending List and Storage
    function removeTaskFromPending(taskId, pendingItem) {
        chrome.storage.local.get('pendingTasks', function (data) {
            const pendingTasks = data.pendingTasks.filter((t) => t.id !== taskId);
            chrome.storage.local.set({ pendingTasks: pendingTasks });

            // Remove task from UI
            pendingList.removeChild(pendingItem);

            // Show notification
            chrome.runtime.sendMessage({ type: 'showNotification', title: 'Task Deleted', message: 'Pending Task has been removed.' });
        });
    }

    // Remove Task from To-Do List and Storage
    function removeTask(taskId, todoItem) {
        chrome.storage.local.get('tasks', function (data) {
            const tasks = data.tasks.filter((t) => t.id !== taskId);
            chrome.storage.local.set({ tasks: tasks });

            // Remove task from UI
            todoList.removeChild(todoItem);

            // Remove the alarm associated with this task
            chrome.runtime.sendMessage({ type: 'removeAlarm', taskId: taskId });

            // Show notification
            chrome.runtime.sendMessage({ type: 'showNotification', title: 'Task Deleted', message: 'Task has been removed.' });
        });
    }

    // Clear All Completed Tasks
    clearAllButton.addEventListener('click', function () {
        chrome.storage.local.set({ completedTasks: [] }, function () {
            doneList.innerHTML = ''; // Clear the UI list
            chrome.runtime.sendMessage({ type: 'showNotification', title: 'Completed Tasks Cleared', message: 'All completed tasks have been removed.' });
        });
    });

    // Update the list of recent 5 completed tasks
    function updateRecentTasks(completedTasks) {
        doneList.innerHTML = ''; // Clear the current list
        completedTasks.forEach((task) => {
            const taskItem = document.createElement('li');
            taskItem.textContent = `${task.description} - Completed`;
            doneList.appendChild(taskItem);
        });
    }
});
