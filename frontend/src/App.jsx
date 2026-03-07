import React, { useState, useEffect } from 'react';

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');

  // Fetch tasks from the backend API
  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(setTasks)
      .catch(console.error);
  }, []);

  const addTask = async () => {
    if (!title.trim()) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const newTask = await res.json();
    setTasks([newTask, ...tasks]);
    setTitle('');
  };

  const deleteTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(tasks.filter(t => t._id !== id));
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'Arial' }}>
      <h1>DevSecOps Task Manager</h1>
      <div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Enter a task..."
          style={{ padding: '8px', width: '70%' }}
        />
        <button onClick={addTask} style={{ padding: '8px 16px', marginLeft: '8px' }}>
          Add Task
        </button>
      </div>
      <ul style={{ marginTop: '20px', listStyle: 'none', padding: 0 }}>
        {tasks.map(task => (
          <li key={task._id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            {task.title}
            <button onClick={() => deleteTask(task._id)} style={{ color: 'red' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
