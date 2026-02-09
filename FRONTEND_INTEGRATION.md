# 🔌 Frontend Integration Guide

How to connect your React frontend to the backend API.

## 🚀 Quick Start

### Step 1: Update Frontend .env

Create/update `.env` in your React project root:

```env
REACT_APP_API_URL=http://localhost:3001/api
```

### Step 2: Update API Service

Update `src/utils/api.js` to use real backend:

```javascript
// src/utils/api.js

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API call failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Authentication API
export const authAPI = {
  login: async (username, password) => {
    return apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  logout: async () => {
    return apiCall('/auth/logout', { method: 'POST' });
  },

  verifyToken: async () => {
    return apiCall('/auth/verify');
  },

  register: async (username, password, role) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
  },

  changePassword: async (currentPassword, newPassword) => {
    return apiCall('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }
};

// Schedule API
export const scheduleAPI = {
  getAll: async () => {
    return apiCall('/schedules');
  },

  saveClass: async (scheduleData) => {
    return apiCall('/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData)
    });
  },

  deleteClass: async (group, day, time) => {
    return apiCall(`/schedules/${encodeURIComponent(group)}/${day}/${time}`, {
      method: 'DELETE'
    });
  },

  getByDay: async (day) => {
    return apiCall(`/schedules/day/${day}`);
  },

  getByTeacher: async (teacher) => {
    return apiCall(`/schedules/teacher/${encodeURIComponent(teacher)}`);
  },

  getByGroup: async (group) => {
    return apiCall(`/schedules/group/${encodeURIComponent(group)}`);
  },

  getAllTeachers: async () => {
    return apiCall('/schedules/teachers');
  }
};

// Groups API
export const groupsAPI = {
  getAll: async () => {
    return apiCall('/groups');
  },

  add: async (groupName) => {
    return apiCall('/groups', {
      method: 'POST',
      body: JSON.stringify({ name: groupName })
    });
  },

  delete: async (groupName) => {
    return apiCall(`/groups/${encodeURIComponent(groupName)}`, {
      method: 'DELETE'
    });
  }
};

export default {
  auth: authAPI,
  schedule: scheduleAPI,
  groups: groupsAPI
};
```

### Step 3: Update AuthContext

Update `src/context/AuthContext.js`:

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token on mount
    const verifyToken = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const result = await api.auth.verifyToken();
          if (result.success) {
            setUser(result.user);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('scheduleUser');
          }
        } catch (error) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('scheduleUser');
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (username, password) => {
    try {
      const result = await api.auth.login(username, password);
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        localStorage.setItem('scheduleUser', JSON.stringify(result.user));
        localStorage.setItem('authToken', result.token);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('scheduleUser');
      localStorage.removeItem('authToken');
    }
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### Step 4: Update ScheduleContext

Update `src/context/ScheduleContext.js`:

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { DAYS } from '../data/constants';

const ScheduleContext = createContext();

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};

export const ScheduleProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, scheduleData, teachersData] = await Promise.all([
        api.groups.getAll(),
        api.schedule.getAll(),
        api.schedule.getAllTeachers()
      ]);
      
      setGroups(groupsData);
      setSchedule(scheduleData);
      setTeachers(teachersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOrUpdateClass = async (group, day, time, classData) => {
    try {
      const result = await api.schedule.saveClass({
        group,
        day,
        time,
        ...classData
      });

      if (result.success) {
        // Update local state
        const key = `${group}-${day}-${time}`;
        setSchedule(prev => ({
          ...prev,
          [key]: {
            ...classData,
            group,
            day,
            time,
            id: result.data.id
          }
        }));

        // Reload teachers list
        const teachersData = await api.schedule.getAllTeachers();
        setTeachers(teachersData);

        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error saving class:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteClass = async (group, day, time) => {
    try {
      const result = await api.schedule.deleteClass(group, day, time);
      
      if (result.success) {
        // Update local state
        const key = `${group}-${day}-${time}`;
        setSchedule(prev => {
          const newSchedule = { ...prev };
          delete newSchedule[key];
          return newSchedule;
        });

        // Reload teachers list
        const teachersData = await api.schedule.getAllTeachers();
        setTeachers(teachersData);

        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error deleting class:', error);
      return { success: false, error: error.message };
    }
  };

  const addGroup = async (groupName) => {
    try {
      const result = await api.groups.add(groupName);
      
      if (result.success) {
        setGroups(prev => [...prev, groupName]);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error adding group:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteGroup = async (groupName) => {
    try {
      const result = await api.groups.delete(groupName);
      
      if (result.success) {
        setGroups(prev => prev.filter(g => g !== groupName));
        
        // Remove schedules for this group from local state
        setSchedule(prev => {
          const newSchedule = {};
          Object.entries(prev).forEach(([key, value]) => {
            if (value.group !== groupName) {
              newSchedule[key] = value;
            }
          });
          return newSchedule;
        });

        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error deleting group:', error);
      return { success: false, error: error.message };
    }
  };

  const clearSchedule = async () => {
    // This would need a backend endpoint to clear all schedules
    // For now, you'd need to delete each schedule individually
    console.warn('Clear schedule not implemented with backend');
  };

  const getClassByKey = (group, day, time) => {
    const key = `${group}-${day}-${time}`;
    return schedule[key] || null;
  };

  const exportSchedule = () => {
    const data = {
      groups,
      schedule,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  };

  const importSchedule = async (jsonData) => {
    // This would need careful handling with backend
    console.warn('Import schedule not fully implemented with backend');
    return { success: false, error: 'Import not yet supported' };
  };

  const value = {
    groups,
    schedule,
    teachers,
    timeSlots: ['08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '12:30', '13:10', '14:00', '14:45', '15:30', '16:15', '17:00', '17:45'],
    days: DAYS,
    loading,
    addOrUpdateClass,
    deleteClass,
    addGroup,
    deleteGroup,
    clearSchedule,
    getClassByKey,
    exportSchedule,
    importSchedule,
    reload: loadData
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};
```

### Step 5: Handle Loading State

Update `src/App.js` to handle loading:

```javascript
import { useAuth } from './context/AuthContext';
import { useSchedule } from './context/ScheduleContext';

const AppContent = () => {
  const { loading: authLoading } = useAuth();
  const { loading: scheduleLoading } = useSchedule();

  if (authLoading || scheduleLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  // Rest of your AppContent component
};
```

## ✅ Testing Integration

1. **Start Backend**
```bash
cd schedule-backend
npm start
```

2. **Start Frontend**
```bash
cd university-schedule
npm start
```

3. **Test Login**
- Open http://localhost:3000
- Login with: admin / admin123
- Should receive JWT token

4. **Test Features**
- View schedule (should load from API)
- Add a class (should save to database)
- Delete a class (should remove from database)
- Add a group (should save to database)
- Filters should work

## 🔒 Production Checklist

- [ ] Change admin password
- [ ] Use environment variables
- [ ] Enable HTTPS
- [ ] Update CORS_ORIGIN to production URL
- [ ] Set secure JWT_SECRET
- [ ] Enable rate limiting
- [ ] Add monitoring
- [ ] Set up backups
- [ ] Test all endpoints
- [ ] Load testing

## 🐛 Common Issues

### CORS Error
**Problem:** "Access to fetch blocked by CORS policy"

**Solution:** Update backend `.env`:
```env
CORS_ORIGIN=http://localhost:3000
```

### 401 Unauthorized
**Problem:** "Access denied. No token provided"

**Solution:** Check token is being sent:
```javascript
// In api.js, make sure token is included
const token = localStorage.getItem('authToken');
headers: {
  Authorization: `Bearer ${token}`
}
```

### Connection Refused
**Problem:** "Failed to fetch"

**Solution:** 
1. Check backend is running
2. Verify API URL in `.env`
3. Check port 3001 is not blocked

### Token Expired
**Problem:** "Invalid or expired token"

**Solution:** User needs to login again. Implement auto-logout on 403 errors.

---

**Your frontend is now connected to the backend!** 🎉
