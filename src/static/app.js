document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const logoutButton = document.getElementById("logout-button");
  const authStatus = document.getElementById("auth-status");
  const messageDiv = document.getElementById("message");
  const emailInput = document.getElementById("email");

  let authToken = localStorage.getItem("authToken");
  let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  function showAuthStatus(text, type = "info") {
    authStatus.textContent = text;
    authStatus.className = type;
    authStatus.classList.remove("hidden");
  }

  function updateAuthUI() {
    const logoutVisible = !!currentUser;
    logoutButton.classList.toggle("hidden", !logoutVisible);

    if (currentUser) {
      showAuthStatus(`Signed in as ${currentUser.username} (${currentUser.role})`, "success");
      if (currentUser.role === "student") {
        emailInput.value = currentUser.email;
        emailInput.readOnly = true;
      } else {
        emailInput.readOnly = false;
      }
    } else {
      authStatus.className = "hidden";
      authStatus.textContent = "";
      emailInput.readOnly = false;
      emailInput.value = "";
    }
  }

  async function authFetch(url, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    options.headers = headers;
    return fetch(url, options);
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsHTML = details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants.map((email) => {
                  const canRemove = currentUser?.role === "admin" || currentUser?.email === email;
                  return `<li><span class="participant-email">${email}</span>${canRemove ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`;
                }).join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      showMessage("Please log in to unregister.", "error");
      return;
    }

    try {
      const response = await authFetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      showMessage("Please log in before signing up.", "error");
      return;
    }

    const email = emailInput.value;
    const activity = activitySelect.value;

    if (!activity) {
      showMessage("Please select an activity.", "error");
      return;
    }

    try {
      const response = await authFetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        if (currentUser?.role !== "student") {
          signupForm.reset();
        }
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

      const response = await fetch("/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const result = await response.json();
      if (!response.ok) {
        showAuthStatus(result.detail || "Login failed.", "error");
        return;
      }

      authToken = result.access_token;
      localStorage.setItem("authToken", authToken);

      const meResponse = await authFetch("/me");
      if (!meResponse.ok) {
        showAuthStatus("Could not load user profile.", "error");
        return;
      }

      currentUser = await meResponse.json();
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      updateAuthUI();
      fetchActivities();
      showAuthStatus("Login successful.", "success");
      loginForm.reset();
    } catch (error) {
      showAuthStatus("Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("register-username").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showAuthStatus(result.detail || "Registration failed.", "error");
        return;
      }

      showAuthStatus("Registration successful. You can now log in.", "success");
      registerForm.reset();
    } catch (error) {
      showAuthStatus("Registration failed. Please try again.", "error");
      console.error("Registration error:", error);
    }
  });

  logoutButton.addEventListener("click", () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    updateAuthUI();
    fetchActivities();
    showAuthStatus("Logged out.", "info");
  });

  async function initialize() {
    if (authToken) {
      try {
        const meResponse = await authFetch("/me");
        if (meResponse.ok) {
          currentUser = await meResponse.json();
          localStorage.setItem("currentUser", JSON.stringify(currentUser));
        } else {
          authToken = null;
          currentUser = null;
          localStorage.removeItem("authToken");
          localStorage.removeItem("currentUser");
        }
      } catch (error) {
        authToken = null;
        currentUser = null;
        localStorage.removeItem("authToken");
        localStorage.removeItem("currentUser");
      }
    }
    updateAuthUI();
    fetchActivities();
  }

  initialize();
});
