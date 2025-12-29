/**
 * Notify Toast System - Centralized notification utility
 * Usage: notify(message, type) where type is 'success' | 'error' | 'warning' | 'info'
 * 
 * Requires: css/global.css (contains .notify styles)
 */

window.notify = function (message, type = "info") {
    // Remove existing notification
    const existing = document.querySelector(".notify");
    if (existing) existing.remove();

    // Create notification element
    const div = document.createElement("div");
    div.className = `notify ${type}`;
    div.textContent = message;
    document.body.appendChild(div);

    // Show with animation
    requestAnimationFrame(() => div.classList.add("show"));

    // Auto-hide and remove
    setTimeout(() => div.classList.remove("show"), 2800);
    setTimeout(() => div.remove(), 3300);
};
