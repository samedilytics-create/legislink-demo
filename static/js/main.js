// Main JavaScript file

/** Utah timezone (America/Denver). All displayed times should use these helpers. */

/**
 * Format an ISO 8601 UTC string for display in Utah time.
 * @param {string} isoString - ISO 8601 datetime string (e.g. from API or data attribute)
 * @param {'datetime'|'date'|'time'} [style='datetime'] - 'datetime' (1/6/24, 7:32 PM), 'date' (1/6/24), 'time' (7:32 PM)
 * @returns {string} Formatted string in Utah time, or '' if invalid
 */
function formatUtahTime(isoString, style = 'datetime') {
    if (!isoString) return '';
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    var opts = { timeZone: 'America/Denver' };
    if (style === 'date') {
        opts.dateStyle = 'short';
    } else if (style === 'time') {
        opts.timeStyle = 'short';
    } else {
        opts.dateStyle = 'short';
        opts.timeStyle = 'short';
    }
    return new Intl.DateTimeFormat('en-US', opts).format(d);
}

// Auto-hide flash messages after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
    // Convert [data-utc-datetime] and [data-utc-date] to Utah time on load
    document.querySelectorAll('[data-utc-datetime]').forEach(function(el) {
        var s = el.getAttribute('data-utc-datetime');
        if (s) { el.textContent = formatUtahTime(s, 'datetime'); }
    });
    document.querySelectorAll('[data-utc-date]').forEach(function(el) {
        var s = el.getAttribute('data-utc-date');
        if (s) { el.textContent = formatUtahTime(s, 'date'); }
    });
    setTimeout(function() {
        const flashMessages = document.querySelectorAll('.flash-toasts article.message, article.error, article.success, article.info');
        flashMessages.forEach(function(message) {
            message.style.transition = 'opacity 0.5s';
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 500);
        });
    }, 5000);

    // Password show/hide toggle
    document.querySelectorAll('.password-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var wrap = btn.closest('.password-input-wrapper');
            var input = wrap && wrap.querySelector('input');
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                btn.setAttribute('aria-label', 'Hide password');
                btn.setAttribute('title', 'Hide password');
            } else {
                input.type = 'password';
                btn.setAttribute('aria-label', 'Show password');
                btn.setAttribute('title', 'Show password');
            }
        });
    });

    // Handle notification checkbox changes
    const notificationCheckboxes = document.querySelectorAll('.notification-checkbox');
    notificationCheckboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            const notificationItem = this.closest('.notification-item');
            const notificationsList = notificationItem ? notificationItem.closest('.notifications-list') : null;
            const notificationId = checkbox.getAttribute('data-notification-id') || (notificationItem && notificationItem.getAttribute('data-notification-id'));

            if (this.checked && notificationId) {
                fetch('/lobbyist/notifications/' + notificationId + '/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                }).catch(function() {});
            }

            if (!notificationsList) return;

            if (this.checked) {
                // After 1 second, fade text and glide to bottom
                setTimeout(function() {
                    // FLIP animation technique
                    // First: Get initial position
                    const firstRect = notificationItem.getBoundingClientRect();
                    const firstTop = firstRect.top;
                    
                    // Add faded class for styling
                    notificationItem.classList.add('faded');
                    
                    // Last: Move to bottom and get final position
                    notificationsList.appendChild(notificationItem);
                    const lastRect = notificationItem.getBoundingClientRect();
                    const lastTop = lastRect.top;
                    
                    // Invert: Calculate the difference and apply transform
                    const deltaY = firstTop - lastTop;
                    
                    // Apply transform to make it appear in original position
                    notificationItem.style.transform = `translateY(${deltaY}px)`;
                    notificationItem.style.transition = 'none';
                    
                    // Force reflow
                    notificationItem.offsetHeight;
                    
                    // Play: Animate to final position
                    notificationItem.style.transition = 'transform 0.5s ease, opacity 0.3s ease';
                    requestAnimationFrame(function() {
                        notificationItem.style.transform = 'translateY(0)';
                    });
                    
                    // Clean up after animation
                    setTimeout(function() {
                        notificationItem.style.transform = '';
                        notificationItem.style.transition = '';
                    }, 500);
                }, 1000); // Wait 1 full second before fading and moving
            } else {
                // Remove faded class immediately
                notificationItem.classList.remove('faded');
                
                // Move back to original position (before any faded items)
                const fadedItems = Array.from(notificationsList.querySelectorAll('.notification-item.faded'));
                if (fadedItems.length > 0) {
                    const firstFaded = fadedItems[0];
                    notificationsList.insertBefore(notificationItem, firstFaded);
                } else {
                    // If no faded items, move to top
                    notificationsList.insertBefore(notificationItem, notificationsList.firstChild);
                }
            }
        });
    });

    // Handle preferences button toggle
    const preferencesButton = document.querySelector('.card-preferences-button');
    if (preferencesButton) {
        const notificationsList = document.querySelector('.notifications-list');
        const settingsPane = document.querySelector('.notifications-settings-pane');
        
        preferencesButton.addEventListener('click', function() {
            const isSettingsVisible = settingsPane.style.display !== 'none';
            
            if (isSettingsVisible) {
                // Switch to notifications list
                settingsPane.style.display = 'none';
                notificationsList.style.display = 'flex';
            } else {
                // Switch to settings pane
                notificationsList.style.display = 'none';
                settingsPane.style.display = 'block';
            }
        });
        
        // Handle cancel button
        const cancelButton = document.querySelector('.settings-cancel-button');
        if (cancelButton) {
            cancelButton.addEventListener('click', function() {
                settingsPane.style.display = 'none';
                notificationsList.style.display = 'flex';
            });
        }
    }

    // Handle clickable table rows
    const clickableRows = document.querySelectorAll('.clickable-row');
    clickableRows.forEach(function(row) {
        row.addEventListener('click', function(e) {
            // Don't navigate if clicking on track flag, track cell, or hide untracked button (let flag handler deal with it)
            if (e.target.closest('.track-flag') || e.target.closest('.track-cell') || 
                e.target.closest('.track-header') || e.target.closest('#hide-untracked-btn')) {
                return; // Don't stop propagation, let flag handler process it
            }
            // Don't navigate if clicking on flag picker button or flag dots (let flag picker handler process it)
            if (e.target.closest('.flag-picker-btn') || e.target.closest('.flag-indicators') || e.target.closest('.clickable-flag-dot')) {
                return; // Don't stop propagation, let flag picker handler process it
            }
            // Don't navigate if clicking on opinion icon or opinion cell
            // Check for clickable-opinion first (let opinion handler process it)
            if (e.target.closest('.clickable-opinion')) {
                return; // Don't stop propagation - let opinion handler run first
            }
            // Check for opinion-icon or opinion-cell (non-clickable elements)
            if (e.target.closest('.opinion-icon') || e.target.closest('.opinion-cell')) {
                e.stopPropagation();
                return;
            }
            // Don't navigate if clicking on a link inside the row
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                e.stopPropagation();
                return;
            }
            // Don't navigate if clicking on the tooltip or anything inside it
            if (e.target.closest('.opinion-tooltip')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            // Don't navigate if clicking on note button (let note modal handler process it)
            if (e.target.closest('.note-btn') || e.target.closest('.note-cell')) {
                return; // Don't stop propagation, let note modal handler process it
            }
            // Don't navigate if clicking on a button that's not a track flag, flag picker, or note
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                e.stopPropagation();
                return;
            }
            
            const url = this.getAttribute('data-url');
            if (url) {
                window.location.href = url;
            }
        }, true); // Use capture phase to check before other handlers
    });

    // Handle opinion bar hover tooltips
    const opinionBars = document.querySelectorAll('.opinion-bar');
    opinionBars.forEach(function(bar) {
        const tooltip = bar.nextElementSibling;
        if (!tooltip || !tooltip.classList.contains('opinion-tooltip')) {
            return;
        }
        
        let mouseX = 0;
        let mouseY = 0;
        let tooltipLocked = false;
        
        // Track mouse position and update tooltip
        const updateTooltipPosition = function() {
            if (!tooltip.classList.contains('show')) {
                return;
            }
            
            const tooltipRect = tooltip.getBoundingClientRect();
            const offset = 12;
            
            let left = mouseX + offset;
            let top = mouseY + offset;
            
            // Adjust if tooltip goes off screen horizontally
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = mouseX - tooltipRect.width - offset;
            }
            if (left < 10) {
                left = 10;
            }
            
            // Adjust if tooltip goes off screen vertically
            if (top + tooltipRect.height > window.innerHeight - 10) {
                top = mouseY - tooltipRect.height - offset;
            }
            if (top < 10) {
                top = 10;
            }
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        };
        
        // Helper function to check if mouse is moving to tooltip
        const isMovingToTooltip = function(relatedTarget) {
            return relatedTarget && (relatedTarget === tooltip || tooltip.contains(relatedTarget));
        };
        
        const segments = bar.querySelectorAll('.opinion-segment');
        segments.forEach(function(segment) {
            segment.addEventListener('mouseenter', function(e) {
                if (tooltipLocked) return;
                
                const opinion = this.getAttribute('data-opinion');
                const orgsJson = this.getAttribute('data-orgs');
                let organizations = [];
                
                try {
                    organizations = JSON.parse(orgsJson || '[]');
                } catch (e) {
                    organizations = [];
                }
                
                const count = organizations.length;
                const displayCount = Math.min(10, organizations.length);
                const displayedOrgs = organizations.slice(0, displayCount);
                const remainingCount = count - displayCount;
                
                // Build tooltip content
                let tooltipContent = '<div class="tooltip-title">' + opinion + '</div>';
                tooltipContent += '<div class="tooltip-count">' + count + ' organization' + (count !== 1 ? 's' : '') + '</div>';
                
                if (displayedOrgs.length > 0) {
                    tooltipContent += '<div class="tooltip-orgs">';
                    displayedOrgs.forEach(function(org) {
                        tooltipContent += '• ' + org + '<br>';
                    });
                    if (remainingCount > 0) {
                        tooltipContent += '<div class="tooltip-more">... and ' + remainingCount + ' more</div>';
                    }
                    tooltipContent += '</div>';
                }
                
                tooltip.innerHTML = tooltipContent;
                tooltip.classList.add('show');
                
                mouseX = e.clientX;
                mouseY = e.clientY;
                updateTooltipPosition();
            });
            
            segment.addEventListener('mousemove', function(e) {
                if (!tooltipLocked) {
                    mouseX = e.clientX;
                    mouseY = e.clientY;
                    updateTooltipPosition();
                }
            });
            
            segment.addEventListener('mouseleave', function(e) {
                if (isMovingToTooltip(e.relatedTarget)) {
                    tooltipLocked = true;
                    return;
                }
                if (!tooltipLocked) {
                    tooltip.classList.remove('show');
                }
            });
        });
        
        // Keep tooltip visible when hovering over it
        tooltip.addEventListener('mouseenter', function() {
            tooltipLocked = true;
            tooltip.classList.add('show');
        });
        
        // Update tooltip position when mouse moves over tooltip
        tooltip.addEventListener('mousemove', function(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            updateTooltipPosition();
        });
        
        tooltip.addEventListener('mouseleave', function() {
            tooltipLocked = false;
            tooltip.classList.remove('show');
        });
        
        // Handle mouse leave on the bar itself
        bar.addEventListener('mouseleave', function(e) {
            if (isMovingToTooltip(e.relatedTarget)) {
                tooltipLocked = true;
                return;
            }
            if (!tooltipLocked) {
                tooltip.classList.remove('show');
            }
        });
        
        // Prevent tooltip clicks from triggering row navigation
        tooltip.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }, true);
        
        // Allow clicks on the opinion bar to trigger row navigation (but not on tooltip)
        bar.addEventListener('click', function(e) {
            if (e.target.closest('.opinion-tooltip')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            
            const row = bar.closest('.clickable-row');
            if (row) {
                const url = row.getAttribute('data-url');
                if (url) {
                    e.stopPropagation();
                    window.location.href = url;
                    return false;
                }
            }
        });
    });

    // Table column resizing
    const tables = document.querySelectorAll('.table-wrapper table');
    tables.forEach(function(table) {
        const headers = table.querySelectorAll('thead th');
        let isResizing = false;
        let currentHeader = null;
        let startX = 0;
        let startWidth = 0;
        let nextHeader = null;
        let nextStartWidth = 0;
        
        headers.forEach(function(header, index) {
            if (index < headers.length - 1) {
                // Only add resize to non-last columns
                header.addEventListener('mousedown', function(e) {
                    const rect = header.getBoundingClientRect();
                    const handleWidth = 8; // Slightly wider for easier clicking
                    const handleLeft = rect.right - handleWidth / 2;
                    const handleRight = rect.right + handleWidth / 2;
                    
                    // Check if click is on the resize handle area
                    if (e.clientX >= handleLeft && e.clientX <= handleRight) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        isResizing = true;
                        currentHeader = header;
                        startX = e.clientX;
                        startWidth = header.offsetWidth;
                        
                        // Get the next header
                        nextHeader = headers[index + 1];
                        nextStartWidth = nextHeader.offsetWidth;
                        
                        // Set table layout to fixed to enable column resizing
                        table.style.tableLayout = 'fixed';
                        currentHeader.style.width = startWidth + 'px';
                        if (nextHeader) {
                            nextHeader.style.width = nextStartWidth + 'px';
                        }
                        
                        currentHeader.classList.add('resizing');
                        document.body.style.cursor = 'col-resize';
                        document.body.style.userSelect = 'none';
                    }
                });
            }
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isResizing || !currentHeader) return;
            
            e.preventDefault();
            const diff = e.clientX - startX;
            const newWidth = Math.max(50, startWidth + diff); // Minimum width of 50px
            
            // Calculate new width for next column
            const totalWidth = startWidth + nextStartWidth;
            const nextNewWidth = Math.max(50, totalWidth - newWidth);
            
            currentHeader.style.width = newWidth + 'px';
            if (nextHeader) {
                nextHeader.style.width = nextNewWidth + 'px';
            }
        });
        
        document.addEventListener('mouseup', function(e) {
            if (isResizing && currentHeader) {
                isResizing = false;
                currentHeader.classList.remove('resizing');
                currentHeader = null;
                nextHeader = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    });

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuToggle && mobileMenu) {
        // Clone sidebar navigation to mobile menu
        const sidebar = document.querySelector('.sidebar nav');
        const mobileMenuContent = mobileMenu.querySelector('.mobile-menu-content');
        
        if (sidebar && mobileMenuContent) {
            const clonedNav = sidebar.cloneNode(true);
            mobileMenuContent.appendChild(clonedNav);
        }
        
        // Clone header navigation items to mobile menu
        const headerNav = document.querySelector('nav.container-fluid > ul');
        if (headerNav && mobileMenuContent) {
            const mobileNav = mobileMenuContent.querySelector('nav ul');
            if (mobileNav) {
                const clonedHeaderNav = headerNav.cloneNode(true);
                // Append header nav items (they'll have borders from existing CSS)
                const headerItems = Array.from(clonedHeaderNav.querySelectorAll('li'));
                headerItems.forEach(function(item) {
                    mobileNav.appendChild(item);
                });
                
                // Replace user profile component with separate menu items
                const mobileProfileComponent = mobileNav.querySelector('.user-profile-component');
                if (mobileProfileComponent) {
                    // Get logout URL from existing logout link
                    const logoutLink = mobileProfileComponent.querySelector('.logout-text');
                    const logoutUrl = logoutLink ? logoutLink.getAttribute('href') : '#';
                    
                    // Create Profile Details menu item
                    const profileDetailsItem = document.createElement('li');
                    const profileDetailsLink = document.createElement('a');
                    profileDetailsLink.href = '#'; // TODO: Add profile details route
                    profileDetailsLink.innerHTML = `
                        <span class="icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </span>
                        <span class="text">Profile Details</span>
                    `;
                    profileDetailsItem.appendChild(profileDetailsLink);
                    
                    // Create Logout menu item
                    const logoutItem = document.createElement('li');
                    const logoutLinkElement = document.createElement('a');
                    logoutLinkElement.href = logoutUrl;
                    logoutLinkElement.innerHTML = `
                        <span class="icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </span>
                        <span class="text">Logout</span>
                    `;
                    logoutItem.appendChild(logoutLinkElement);
                    
                    // Replace the user-profile-component with the new items
                    mobileProfileComponent.parentNode.replaceChild(profileDetailsItem, mobileProfileComponent);
                    profileDetailsItem.parentNode.insertBefore(logoutItem, profileDetailsItem.nextSibling);
                }
            }
        }
        
        // Toggle menu
        mobileMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            mobileMenu.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        mobileMenu.addEventListener('click', function(e) {
            if (e.target === mobileMenu) {
                mobileMenu.classList.remove('active');
            }
        });
        
        // Close menu when clicking a link
        const mobileMenuLinks = mobileMenu.querySelectorAll('a');
        mobileMenuLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
            });
        });
    }

    // Lobbyist table filter functionality
    const billsTable = document.getElementById('bills-table');
    const lobbyistFilter = document.getElementById('lobbyist-global-filter');
    const lobbyistLegislationTypeFilter = document.getElementById('lobbyist-legislation_type');
    const lobbyistCategoryFilter = document.getElementById('lobbyist-category');
    const lobbyistStatusFilter = document.getElementById('lobbyist-status_filter');
    const lobbyistFlagFilter = document.getElementById('lobbyist-flag_filter');

    if (billsTable && lobbyistFilter) {
        const tbody = billsTable.querySelector('tbody');
        // Get all rows, but exclude any test/demo rows that might not have proper data attributes
        const allRows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        const lobbyistRows = allRows.filter(function(row) {
            // Only include rows that have a data-bill-id attribute (real data rows)
            return row.hasAttribute('data-bill-id');
        });

        // Populate status filter dropdown with unique statuses from the table
        if (lobbyistStatusFilter) {
            const statuses = new Set();
            lobbyistRows.forEach(function(row) {
                const statusCell = row.querySelector('td[data-column="status"]');
                if (statusCell) {
                    const statusText = statusCell.textContent.trim();
                    if (statusText) {
                        statuses.add(statusText);
                    }
                }
            });
            // Sort statuses alphabetically and add as options
            Array.from(statuses).sort().forEach(function(status) {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                lobbyistStatusFilter.appendChild(option);
            });
        }

        // Filter function for lobbyist table - searches across all columns and applies dropdown filters
        const applyLobbyistFilter = function() {
            const filterValue = lobbyistFilter.value.toLowerCase().trim();
            const legislationType = lobbyistLegislationTypeFilter ? lobbyistLegislationTypeFilter.value : '';
            const category = lobbyistCategoryFilter ? lobbyistCategoryFilter.value : '';
            const statusValue = lobbyistStatusFilter ? lobbyistStatusFilter.value : '';
            const flagColor = lobbyistFlagFilter ? lobbyistFlagFilter.value : '';
            
            lobbyistRows.forEach(function(row) {
                let showRow = true;
                
                // Apply flag filter FIRST - this should work independently
                if (flagColor) {
                    const flagCell = row.querySelector('td[data-column="flags"]');
                    if (flagCell) {
                        // Check ALL flag dots to see if any match the selected color
                        const allFlagDots = flagCell.querySelectorAll('.flag-dot');
                        let hasMatchingFlag = false;
                        for (let i = 0; i < allFlagDots.length; i++) {
                            const dot = allFlagDots[i];
                            const dotColor = dot.getAttribute('data-flag-color');
                            // Compare as strings to ensure exact match
                            if (String(dotColor) === String(flagColor)) {
                                hasMatchingFlag = true;
                                break; // Found a match, no need to continue
                            }
                        }
                        if (!hasMatchingFlag) {
                            showRow = false;
                        }
                    } else {
                        // If no flag cell exists, hide row when filtering by flag
                        showRow = false;
                    }
                }
                
                // Apply legislation type filter
                if (legislationType) {
                    const billType = row.getAttribute('data-bill-type') || '';
                    if (billType !== legislationType) {
                        showRow = false;
                    }
                }
                
                // Apply category filter
                if (showRow && category) {
                    const categoriesCell = row.querySelector('td[data-column="categories"]');
                    if (categoriesCell) {
                        const categoriesText = categoriesCell.textContent.toLowerCase();
                        if (!categoriesText.includes(category.toLowerCase())) {
                            showRow = false;
                        }
                    } else {
                        showRow = false;
                    }
                }
                
                // Apply status filter
                if (showRow && statusValue) {
                    const statusCell = row.querySelector('td[data-column="status"]');
                    if (statusCell) {
                        const statusText = statusCell.textContent.trim();
                        if (statusText !== statusValue) {
                            showRow = false;
                        }
                    } else {
                        showRow = false;
                    }
                }
                
                // Apply text filter
                if (showRow && filterValue) {
                    let matchesText = false;
                    for (let i = 0; i < row.cells.length; i++) {
                        const cell = row.cells[i];
                        if (cell) {
                            const cellText = cell.textContent.toLowerCase().trim();
                            if (cellText.includes(filterValue)) {
                                matchesText = true;
                                break;
                            }
                        }
                    }
                    showRow = matchesText;
                }
                
                row.style.display = showRow ? '' : 'none';
            });
        };
        
        // Handle filter input changes
        lobbyistFilter.addEventListener('input', applyLobbyistFilter);
        
        // Handle legislation type dropdown changes
        if (lobbyistLegislationTypeFilter) {
            lobbyistLegislationTypeFilter.addEventListener('change', applyLobbyistFilter);
        }
        
        // Handle category dropdown changes
        if (lobbyistCategoryFilter) {
            lobbyistCategoryFilter.addEventListener('change', applyLobbyistFilter);
        }
        
        // Handle status dropdown changes
        if (lobbyistStatusFilter) {
            lobbyistStatusFilter.addEventListener('change', applyLobbyistFilter);
        }
        
        // Handle flag filter dropdown changes
        if (lobbyistFlagFilter) {
            lobbyistFlagFilter.addEventListener('change', applyLobbyistFilter);
        }
        
        // Apply filters on page load if any filters are already set
        applyLobbyistFilter();
        
        // Handle track flag clicks - attach directly to each flag button for reliable detection
        const trackFlags = billsTable.querySelectorAll('.track-flag');
        trackFlags.forEach(function(flag) {
            flag.addEventListener('click', function(e) {
                // Stop event from reaching row click handler
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                const billNumber = this.getAttribute('data-bill-number');
                const isTracked = this.classList.contains('tracked');
                
                if (!billNumber) {
                    console.error('No bill number found on flag:', this);
                    return;
                }
                
                // Determine URL
                const url = isTracked 
                    ? `/lobbyist/untrack/${billNumber}` 
                    : `/lobbyist/track/${billNumber}`;
                
                // Make API call
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin'
                })
                .then(function(response) {
                    if (!response.ok) {
                        return response.text().then(function(text) {
                            throw new Error('Network response was not ok: ' + response.status + ' - ' + text);
                        });
                    }
                    return response.json();
                })
                .then(function(data) {
                    if (data.error) {
                        console.error('Error:', data.error);
                        alert('Error: ' + data.error);
                        return;
                    }
                    
                    // Update flag state - flag is captured from outer scope
                    if (data.tracking) {
                        flag.classList.add('tracked');
                    } else {
                        flag.classList.remove('tracked');
                    }
                    
                    // Re-apply filters to update visibility
                    applyFilters();
                })
                .catch(function(error) {
                    console.error('Error:', error);
                    alert('Failed to update tracking status: ' + error.message);
                });
            });
        });
    }
    
    // Opinion modal functionality - use event delegation on table with capture phase
    const opinionTableForModal = document.getElementById('bills-table');
    const opinionModal = document.getElementById('opinion-modal');
    const opinionForm = document.getElementById('opinion-form');
    
    if (opinionTableForModal && opinionModal && opinionForm) {
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const modalCancelBtn = document.getElementById('modal-cancel-btn');
        const modalBillTitle = document.getElementById('modal-bill-title');
        const modalBillId = document.getElementById('modal-bill-id');
        const modalBillNumber = document.getElementById('modal-bill-number');
        const modalOrganization = document.getElementById('modal-organization');
        const modalOpinion = document.getElementById('modal-opinion');
        const modalAction = document.getElementById('modal-action');
        const modalComments = document.getElementById('modal-comments');
        const modalBillVersion = document.getElementById('modal-bill-version');
        
        if (!modalOpinion || !modalAction || !modalBillNumber || !modalBillTitle) {
            console.error('Modal form elements not found:', {
                modalOpinion: !!modalOpinion,
                modalAction: !!modalAction,
                modalBillNumber: !!modalBillNumber,
                modalBillTitle: !!modalBillTitle
            });
            return;
        }
        
        // Attach click handlers directly to each opinion icon - more reliable
        const tbodyForOpinions = opinionTableForModal.querySelector('tbody');
        if (tbodyForOpinions) {
            const opinionCheckmarks = tbodyForOpinions.querySelectorAll('.clickable-opinion, .opinion-icon');
            
            opinionCheckmarks.forEach(function(checkmark) {
                // Make sure it has the clickable-opinion class
                if (!checkmark.classList.contains('clickable-opinion')) {
                    checkmark.classList.add('clickable-opinion');
                }
                
                checkmark.addEventListener('click', function(e) {
                    // Stop event immediately to prevent row handler from running
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    const billNumber = this.getAttribute('data-bill-number');
                    const billId = this.getAttribute('data-bill-id');
                    const billVersion = this.getAttribute('data-bill-version');
                    
                    if (!billNumber) {
                        console.error('No bill number found on checkmark');
                        alert('Error: Bill number not found');
                        return;
                    }
                    
                    // Set bill info in modal (submit new or edit existing)
                    modalBillTitle.textContent = 'Opinion - ' + billNumber;
                    modalBillId.value = billId || '';
                    modalBillNumber.value = billNumber;
                    
                    // Reset form but keep bill info
                    opinionForm.reset();
                    modalBillId.value = billId || '';
                    modalBillNumber.value = billNumber;
                    
                    // Load my_orgs, bill_versions, and existing opinions; populate org and version dropdowns
                    fetch(`/lobbyist/opinion/${billNumber}`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'same-origin'
                    })
                    .then(function(response) {
                        if (!response.ok) { throw new Error('Failed to load: ' + response.status); }
                        return response.json();
                    })
                    .then(function(data) {
                        var myOrgs = data.my_orgs || [];
                        var opinionsByOrg = data.opinions_by_org || {};
                        // Populate organization dropdown (only orgs this lobbyist represents)
                        if (modalOrganization) {
                            modalOrganization.innerHTML = '<option value="">Select an organization...</option>';
                            myOrgs.forEach(function(o) {
                                var opt = document.createElement('option');
                                opt.value = o.name;
                                opt.textContent = o.name;
                                modalOrganization.appendChild(opt);
                            });
                        }
                        // Pre-fill from (org, version); clear when no opinion for that combo. Never override the version selector.
                        function syncFromOrgAndVersion() {
                            var name = (modalOrganization && modalOrganization.value) || '';
                            var ver = (modalBillVersion && modalBillVersion.value) || '';
                            var rec = (opinionsByOrg[name] && opinionsByOrg[name][ver]) ? opinionsByOrg[name][ver] : null;
                            if (rec) {
                                if (modalOpinion) modalOpinion.value = rec.opinion || '';
                                if (modalAction) modalAction.value = rec.action || '';
                                if (modalComments) modalComments.value = rec.comments || '';
                            } else {
                                if (modalOpinion) modalOpinion.value = '';
                                if (modalAction) modalAction.value = '';
                                if (modalComments) modalComments.value = '';
                            }
                        }
                        if (modalOrganization) { modalOrganization.onchange = syncFromOrgAndVersion; }
                        if (modalBillVersion) { modalBillVersion.onchange = syncFromOrgAndVersion; }
                        // Populate bill version dropdown (lowest at top); default to active version; show (active) next to active
                        var billVersions = data.bill_versions || [];
                        var activeVer = data.default_bill_version || '';
                        var defaultVer = activeVer || (billVersions.length ? billVersions[0] : '');
                        if (modalBillVersion && billVersions.length) {
                            modalBillVersion.innerHTML = billVersions.map(function(v) {
                                var label = v + (activeVer && v === activeVer ? ' (active)' : '');
                                return '<option value="' + v + '">' + label + '</option>';
                            }).join('');
                            modalBillVersion.value = defaultVer;
                        }
                        syncFromOrgAndVersion();
                        // Show no-orgs message and disable submit if lobbyist has no orgs
                        var submitBtn = document.getElementById('modal-submit-btn');
                        var noOrgsEl = document.getElementById('modal-no-orgs-msg');
                        if (noOrgsEl) { noOrgsEl.style.display = myOrgs.length === 0 ? 'block' : 'none'; }
                        if (submitBtn) { submitBtn.disabled = myOrgs.length === 0; }
                        opinionModal.style.display = 'flex';
                        opinionModal.style.zIndex = '2000';
                    })
                    .catch(function(error) {
                        console.error('Error loading opinion:', error);
                        var el = document.getElementById('lobbyist-my-orgs');
                        if (modalOrganization && el) {
                            try {
                                var myOrgs = JSON.parse(el.textContent || '[]');
                                modalOrganization.innerHTML = '<option value="">Select an organization...</option>';
                                myOrgs.forEach(function(o) {
                                    var opt = document.createElement('option');
                                    opt.value = o.name;
                                    opt.textContent = o.name;
                                    modalOrganization.appendChild(opt);
                                });
                            } catch (e) {}
                        }
                        if (modalBillVersion && billVersion) {
                            modalBillVersion.innerHTML = '<option value="' + billVersion + '">' + billVersion + '</option>';
                            modalBillVersion.value = billVersion;
                        }
                        opinionModal.style.display = 'flex';
                        opinionModal.style.zIndex = '2000';
                    });
                }, true); // Use capture phase to run before row handler
            });
        }
        
        // Close modal handlers
        function closeModal() {
            opinionModal.style.display = 'none';
        }
        
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeModal();
            });
        }
        
        if (modalCancelBtn) {
            modalCancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeModal();
            });
        }
        
        // Close modal when clicking outside
        opinionModal.addEventListener('click', function(e) {
            if (e.target === opinionModal) {
                closeModal();
            }
        });
        
        // Handle form submission
        opinionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const billNumber = modalBillNumber.value;
            if (!billNumber) {
                alert('Bill number is missing');
                return;
            }
            
            const orgVal = modalOrganization ? modalOrganization.value : '';
            const formData = {
                organization: orgVal,
                opinion: modalOpinion.value,
                action: modalAction.value,
                comments: modalComments.value,
                bill_version: modalBillVersion.value
            };
            
            if (!orgVal) {
                alert('Please select an organization');
                return;
            }
            if (!formData.opinion) {
                alert('Please select an opinion');
                return;
            }
            if (!formData.action) {
                alert('Please select a recommended action');
                return;
            }
            if ((formData.comments || '').length > 300) {
                alert('Comments must be 300 characters or fewer.');
                return;
            }
            
            // Disable submit button to prevent double submission
            const submitBtn = document.getElementById('modal-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }
            
            // Submit opinion
            fetch(`/lobbyist/opinion/${billNumber}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify(formData)
            })
            .then(function(response) {
                if (!response.ok) {
                    return response.json().then(function(data) {
                        throw new Error(data.error || 'Failed to save opinion');
                    });
                }
                return response.json();
            })
            .then(function(data) {
                // Close modal
                closeModal();
                
                // Reload page to update opinion display
                window.location.reload();
            })
            .catch(function(error) {
                console.error('Error saving opinion:', error);
                alert('Failed to save opinion: ' + error.message);
                
                // Re-enable submit button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Opinion';
                }
            });
        });
    }
    
    // Legislator table filter functionality (separate from lobbyist table)
    const legislatorTable = document.getElementById('legislator-bills-table');
    const legislatorFilter = document.getElementById('legislator-global-filter');
    const legislationTypeFilter = document.getElementById('legislation_type');
    const categoryFilter = document.getElementById('category');
    const statusFilter = document.getElementById('status_filter');
    const flagFilter = document.getElementById('flag_filter');

    if (legislatorTable && legislatorFilter) {
        const legislatorTbody = legislatorTable.querySelector('tbody');
        // Get all rows, but exclude any test/demo rows that might not have proper data attributes
        const allRows = legislatorTbody ? Array.from(legislatorTbody.querySelectorAll('tr')) : [];
        const legislatorRows = allRows.filter(function(row) {
            // Only include rows that have a data-bill-id attribute (real data rows)
            return row.hasAttribute('data-bill-id');
        });

        // Populate status filter dropdown with unique statuses from the table
        if (statusFilter) {
            const statuses = new Set();
            legislatorRows.forEach(function(row) {
                const statusCell = row.querySelector('td[data-column="status"]');
                if (statusCell) {
                    const statusText = statusCell.textContent.trim();
                    if (statusText) {
                        statuses.add(statusText);
                    }
                }
            });
            // Sort statuses alphabetically and add as options
            Array.from(statuses).sort().forEach(function(status) {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                statusFilter.appendChild(option);
            });
        }

        // Filter function for legislator table - searches across all columns and applies dropdown filters
        const applyLegislatorFilter = function() {
            const filterValue = legislatorFilter.value.toLowerCase().trim();
            const legislationType = legislationTypeFilter ? legislationTypeFilter.value : '';
            const category = categoryFilter ? categoryFilter.value : '';
            const statusValue = statusFilter ? statusFilter.value : '';
            const flagColor = flagFilter ? flagFilter.value : '';
            
            legislatorRows.forEach(function(row) {
                let showRow = true;
                
                // Apply flag filter FIRST - this should work independently
                if (flagColor) {
                    const flagCell = row.querySelector('td[data-column="flags"]');
                    if (flagCell) {
                        // Check ALL flag dots to see if any match the selected color
                        const allFlagDots = flagCell.querySelectorAll('.flag-dot');
                        let hasMatchingFlag = false;
                        for (let i = 0; i < allFlagDots.length; i++) {
                            const dot = allFlagDots[i];
                            const dotColor = dot.getAttribute('data-flag-color');
                            // Compare as strings to ensure exact match
                            if (String(dotColor) === String(flagColor)) {
                                hasMatchingFlag = true;
                                break; // Found a match, no need to continue
                            }
                        }
                        if (!hasMatchingFlag) {
                            showRow = false;
                        }
                    } else {
                        // If no flag cell exists, hide row when filtering by flag
                        showRow = false;
                    }
                }
                
                // Apply legislation type filter
                if (legislationType) {
                    const billType = row.getAttribute('data-bill-type') || '';
                    if (billType !== legislationType) {
                        showRow = false;
                    }
                }
                
                // Apply category filter
                if (showRow && category) {
                    const categoriesCell = row.querySelector('td[data-column="categories"]');
                    if (categoriesCell) {
                        const categoriesText = categoriesCell.textContent.toLowerCase();
                        if (!categoriesText.includes(category.toLowerCase())) {
                            showRow = false;
                        }
                    } else {
                        showRow = false;
                    }
                }

                // Apply status filter
                if (showRow && statusValue) {
                    const statusCell = row.querySelector('td[data-column="status"]');
                    if (statusCell) {
                        const statusText = statusCell.textContent.trim();
                        if (statusText !== statusValue) {
                            showRow = false;
                        }
                    } else {
                        showRow = false;
                    }
                }

                // Apply text filter
                if (showRow && filterValue) {
                    let matchesText = false;
                    for (let i = 0; i < row.cells.length; i++) {
                        const cell = row.cells[i];
                        if (cell) {
                            const cellText = cell.textContent.toLowerCase().trim();
                            if (cellText.includes(filterValue)) {
                                matchesText = true;
                                break;
                            }
                        }
                    }
                    showRow = matchesText;
                }

                row.style.display = showRow ? '' : 'none';
            });
        };

        // Handle filter input changes
        legislatorFilter.addEventListener('input', applyLegislatorFilter);

        // Handle legislation type dropdown changes
        if (legislationTypeFilter) {
            legislationTypeFilter.addEventListener('change', applyLegislatorFilter);
        }

        // Handle category dropdown changes
        if (categoryFilter) {
            categoryFilter.addEventListener('change', applyLegislatorFilter);
        }

        // Handle status dropdown changes
        if (statusFilter) {
            statusFilter.addEventListener('change', applyLegislatorFilter);
        }

        // Handle flag filter dropdown changes
        if (flagFilter) {
            flagFilter.addEventListener('change', applyLegislatorFilter);
        }
        
        // Apply filters on page load if any filters are already set
        applyLegislatorFilter();
    }
    
    // Filters panel toggle and column visibility for legislator table
    const legislatorFiltersToggleBtn = document.getElementById('filters-toggle-btn');
    const legislatorFiltersPanel = document.getElementById('filters-panel');
    const legislatorColumnVisibilityMenu = document.getElementById('column-visibility-menu');
    const legislatorTableForColumns = document.getElementById('legislator-bills-table');
    
    if (legislatorFiltersToggleBtn && legislatorFiltersPanel) {
        // Toggle filters panel
        legislatorFiltersToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isExpanded = legislatorFiltersPanel.style.display !== 'none';
            legislatorFiltersPanel.style.display = isExpanded ? 'none' : 'block';
            legislatorFiltersToggleBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        });
        
        // Close panel when clicking outside
        document.addEventListener('click', function(e) {
            if (legislatorFiltersToggleBtn && legislatorFiltersPanel &&
                !legislatorFiltersToggleBtn.contains(e.target) &&
                !legislatorFiltersPanel.contains(e.target)) {
                legislatorFiltersPanel.style.display = 'none';
                legislatorFiltersToggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    
    if (legislatorColumnVisibilityMenu && legislatorTableForColumns) {
        // Handle checkbox changes to show/hide columns for legislator table
        const legislatorColumnCheckboxes = legislatorColumnVisibilityMenu.querySelectorAll('.column-checkbox');
        legislatorColumnCheckboxes.forEach(function(checkbox) {
            checkbox.addEventListener('change', function() {
                const columnName = this.getAttribute('data-column');
                const isChecked = this.checked;
                const headers = legislatorTableForColumns.querySelectorAll('th[data-column="' + columnName + '"]');
                const cells = legislatorTableForColumns.querySelectorAll('td[data-column="' + columnName + '"]');
                headers.forEach(function(header) { header.style.display = isChecked ? '' : 'none'; });
                cells.forEach(function(cell) { cell.style.display = isChecked ? '' : 'none'; });
            });
            // Apply initial visibility based on checkbox state
            if (!checkbox.checked) {
                const columnName = checkbox.getAttribute('data-column');
                const headers = legislatorTableForColumns.querySelectorAll('th[data-column="' + columnName + '"]');
                const cells = legislatorTableForColumns.querySelectorAll('td[data-column="' + columnName + '"]');
                headers.forEach(function(header) { header.style.display = 'none'; });
                cells.forEach(function(cell) { cell.style.display = 'none'; });
            }
        });
    }
    
    // Filters panel toggle and column visibility for lobbyist table
    const lobbyistFiltersToggleBtn = document.getElementById('lobbyist-filters-toggle-btn');
    const lobbyistFiltersPanel = document.getElementById('lobbyist-filters-panel');
    const lobbyistColumnVisibilityMenu = document.getElementById('lobbyist-column-visibility-menu');
    const lobbyistTableForColumns = document.getElementById('bills-table');
    
    if (lobbyistFiltersToggleBtn && lobbyistFiltersPanel) {
        // Toggle filters panel
        lobbyistFiltersToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isExpanded = lobbyistFiltersPanel.style.display !== 'none';
            lobbyistFiltersPanel.style.display = isExpanded ? 'none' : 'block';
            lobbyistFiltersToggleBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        });
        
        // Close panel when clicking outside
        document.addEventListener('click', function(e) {
            if (lobbyistFiltersToggleBtn && lobbyistFiltersPanel &&
                !lobbyistFiltersToggleBtn.contains(e.target) &&
                !lobbyistFiltersPanel.contains(e.target)) {
                lobbyistFiltersPanel.style.display = 'none';
                lobbyistFiltersToggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    
    if (lobbyistColumnVisibilityMenu && lobbyistTableForColumns) {
        // Handle checkbox changes to show/hide columns for lobbyist table
        const lobbyistColumnCheckboxes = lobbyistColumnVisibilityMenu.querySelectorAll('.column-checkbox');
        lobbyistColumnCheckboxes.forEach(function(checkbox) {
            checkbox.addEventListener('change', function() {
                const columnName = this.getAttribute('data-column');
                const isChecked = this.checked;
                const headers = lobbyistTableForColumns.querySelectorAll('th[data-column="' + columnName + '"]');
                const cells = lobbyistTableForColumns.querySelectorAll('td[data-column="' + columnName + '"]');
                headers.forEach(function(header) { header.style.display = isChecked ? '' : 'none'; });
                cells.forEach(function(cell) { cell.style.display = isChecked ? '' : 'none'; });
            });
        });
    }

    // Flag Picker Functionality
    const flagPickerModal = document.getElementById('flag-picker-modal');
    const flagPickerBtns = document.querySelectorAll('.flag-picker-btn');
    const clickableFlagDots = document.querySelectorAll('.clickable-flag-dot');
    const flagModalCloseBtn = document.getElementById('flag-modal-close-btn');
    const flagModalCancelBtn = document.getElementById('flag-modal-cancel-btn');
    const flagModalSaveBtn = document.getElementById('flag-modal-save-btn');
    const flagModalBillNumber = document.getElementById('flag-modal-bill-number');
    
    let currentBillId = null;
    let currentBillNumber = null;
    let currentFlags = [];

    // Function to open flag picker modal
    function openFlagPicker(billId, billNumber, triggerElement) {
        currentBillId = billId;
        currentBillNumber = billNumber;

        // Read current flags from DOM (no API call needed)
        // Find the row containing this bill and get its flag dots
        currentFlags = [];
        if (triggerElement) {
            const row = triggerElement.closest('tr');
            if (row) {
                const flagDots = row.querySelectorAll('.flag-dot[data-flag-color]');
                flagDots.forEach(function(dot) {
                    const color = parseInt(dot.getAttribute('data-flag-color'));
                    if (color && !currentFlags.includes(color)) {
                        currentFlags.push(color);
                    }
                });
            }
        }

        // Update modal bill number
        if (flagModalBillNumber) {
            flagModalBillNumber.textContent = `Bill: ${currentBillNumber}`;
        }

        // Set checkboxes based on current flags (labels are pre-rendered in template)
        if (flagPickerModal) {
            const checkboxes = flagPickerModal.querySelectorAll('.flag-checkbox');
            checkboxes.forEach(function(checkbox) {
                const flagColor = parseInt(checkbox.getAttribute('data-flag-color'));
                checkbox.checked = currentFlags.includes(flagColor);
            });

            // Show modal immediately
            flagPickerModal.style.display = 'flex';
        }
    }

    // Only set up flag picker if modal exists
    if (flagPickerModal) {
        // Open flag picker modal from button
        // Use event delegation for flag picker buttons and clickable flag dots
        // This works even if elements are added dynamically or if querySelectorAll runs before elements exist
        document.addEventListener('click', function(e) {
            // Check if click is on a flag picker button
            const flagBtn = e.target.closest('.flag-picker-btn');
            if (flagBtn) {
                e.preventDefault();
                e.stopPropagation();

                const billId = flagBtn.getAttribute('data-bill-id');
                const billNumber = flagBtn.getAttribute('data-bill-number');
                if (billId && billNumber) {
                    openFlagPicker(billId, billNumber, flagBtn);
                }
                return;
            }

            // Check if click is on a clickable flag dot
            const flagDot = e.target.closest('.clickable-flag-dot');
            if (flagDot) {
                e.preventDefault();
                e.stopPropagation();

                const billId = flagDot.getAttribute('data-bill-id');
                const billNumber = flagDot.getAttribute('data-bill-number');
                if (billId && billNumber) {
                    openFlagPicker(billId, billNumber, flagDot);
                }
                return;
            }
        });
            

        // Close modal handlers
        function closeFlagModal() {
            if (flagPickerModal) {
                flagPickerModal.style.display = 'none';
            }
            currentBillId = null;
            currentBillNumber = null;
            currentFlags = [];
        }

        if (flagModalCloseBtn) {
            flagModalCloseBtn.addEventListener('click', closeFlagModal);
        }

        if (flagModalCancelBtn) {
            flagModalCancelBtn.addEventListener('click', closeFlagModal);
        }

        // Close modal when clicking outside
        if (flagPickerModal) {
            flagPickerModal.addEventListener('click', function(e) {
                if (e.target === flagPickerModal) {
                    closeFlagModal();
                }
            });
        }

        // Save flags
        if (flagModalSaveBtn && flagPickerModal) {
            flagModalSaveBtn.addEventListener('click', function() {
                if (!currentBillId) return;
                
                const checkboxes = flagPickerModal.querySelectorAll('.flag-checkbox');
            const selectedFlags = [];
            const flagsToRemove = [];
            
            checkboxes.forEach(function(checkbox) {
                const flagColor = parseInt(checkbox.getAttribute('data-flag-color'));
                if (checkbox.checked) {
                    selectedFlags.push(flagColor);
                } else if (currentFlags.includes(flagColor)) {
                    flagsToRemove.push(flagColor);
                }
            });
            
            // Determine base URL (legislator or lobbyist)
            const isLegislator = window.location.pathname.includes('/legislator/');
            const baseUrl = isLegislator ? '/legislator' : '/lobbyist';
            
            // Remove flags that were unchecked
            const removePromises = flagsToRemove.map(function(flagColor) {
                return fetch(`${baseUrl}/flag/${currentBillId}/${flagColor}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            });
            
            // Add flags that were checked but weren't there before
            const addPromises = selectedFlags
                .filter(function(flagColor) {
                    return !currentFlags.includes(flagColor);
                })
                .map(function(flagColor) {
                    return fetch(`${baseUrl}/flag/${currentBillId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ flag_color: flagColor })
                    });
                });
            
            // Execute all promises
            Promise.all([...removePromises, ...addPromises])
                .then(function(responses) {
                    // Check if all requests succeeded
                    const allSucceeded = responses.every(function(r) {
                        return r.ok || r.status === 200;
                    });
                    
                    if (allSucceeded) {
                        // Reload page to update flag indicators
                        window.location.reload();
                    } else {
                        alert('Error saving flags. Please try again.');
                    }
                })
                .catch(function(error) {
                    console.error('Error saving flags:', error);
                    alert('Error saving flags. Please try again.');
                });
            });
        }
    }

    // Note modal (legislator and lobbyist tables)
    const noteModal = document.getElementById('note-modal');
    const noteModalCloseBtn = document.getElementById('note-modal-close-btn');
    const noteModalCancelBtn = document.getElementById('note-modal-cancel-btn');
    const noteModalSaveBtn = document.getElementById('note-modal-save-btn');
    const noteModalTitle = document.getElementById('note-modal-title');
    const noteModalBillNumber = document.getElementById('note-modal-bill-number');
    const noteModalText = document.getElementById('note-modal-text');
    const noteModalOpinion = document.getElementById('note-modal-opinion');
    let noteModalBillNumberVal = null;

    // Determine base URL for note API (legislator or lobbyist)
    function getNoteBaseUrl() {
        return window.location.pathname.includes('/lobbyist/') ? '/lobbyist' : '/legislator';
    }

    if (noteModal) {
        document.addEventListener('click', function(e) {
            const noteBtn = e.target.closest('.note-btn');
            if (noteBtn) {
                e.preventDefault();
                e.stopPropagation();
                noteModalBillNumberVal = noteBtn.getAttribute('data-bill-number');
                if (!noteModalBillNumberVal) return;
                if (noteModalTitle) noteModalTitle.textContent = 'Internal Note – ' + noteModalBillNumberVal;
                if (noteModalBillNumber) noteModalBillNumber.textContent = 'Bill: ' + noteModalBillNumberVal;
                if (noteModalText) noteModalText.value = '';
                if (noteModalOpinion) noteModalOpinion.value = '';

                // Show modal immediately
                noteModal.style.display = 'flex';

                // Fetch data in background and populate
                var baseUrl = getNoteBaseUrl();
                fetch(baseUrl + '/bill/' + encodeURIComponent(noteModalBillNumberVal) + '/note', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                })
                .then(function(r) { return r.ok ? r.json() : { note: '', opinion: null }; })
                .then(function(data) {
                    if (noteModalText) noteModalText.value = data.note || '';
                    if (noteModalOpinion && data.opinion) noteModalOpinion.value = data.opinion;
                })
                .catch(function() {
                    // Modal already shown, just leave fields empty
                });
            }
        });
        function closeNoteModal() {
            noteModal.style.display = 'none';
            noteModalBillNumberVal = null;
        }
        if (noteModalCloseBtn) noteModalCloseBtn.addEventListener('click', closeNoteModal);
        if (noteModalCancelBtn) noteModalCancelBtn.addEventListener('click', closeNoteModal);
        noteModal.addEventListener('click', function(e) {
            if (e.target === noteModal) closeNoteModal();
        });
        if (noteModalSaveBtn) {
            noteModalSaveBtn.addEventListener('click', function() {
                if (!noteModalBillNumberVal) return;
                var note = noteModalText ? noteModalText.value : '';
                var opinion = noteModalOpinion ? noteModalOpinion.value : '';
                noteModalSaveBtn.disabled = true;
                noteModalSaveBtn.textContent = 'Saving...';
                var baseUrl = getNoteBaseUrl();
                fetch(baseUrl + '/bill/' + encodeURIComponent(noteModalBillNumberVal) + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ note: note, opinion: opinion || null })
                })
                .then(function(r) {
                    if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Failed to save'); });
                    return r.json();
                })
                .then(function() {
                    closeNoteModal();
                    window.location.reload();
                })
                .catch(function(err) {
                    alert('Error saving note: ' + err.message);
                })
                .finally(function() {
                    noteModalSaveBtn.disabled = false;
                    noteModalSaveBtn.textContent = 'Save';
                });
            });
        }
    }

    // Flag Preferences Settings
    const saveFlagPreferencesBtn = document.getElementById('save-flag-preferences-btn');
    if (saveFlagPreferencesBtn) {
        saveFlagPreferencesBtn.addEventListener('click', function() {
            const inputs = document.querySelectorAll('.flag-label-input');
            const preferences = {};
            
            inputs.forEach(function(input) {
                const flagColor = parseInt(input.getAttribute('data-flag-color'));
                const label = input.value.trim();
                if (label) {
                    preferences[flagColor] = label;
                }
            });
            
            // Determine base URL (legislator or lobbyist)
            const isLegislator = window.location.pathname.includes('/legislator/');
            const baseUrl = isLegislator ? '/legislator' : '/lobbyist';
            
            // Save each preference
            const savePromises = Object.keys(preferences).map(function(flagColor) {
                return fetch(`${baseUrl}/flag-preferences`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        flag_color: parseInt(flagColor),
                        label: preferences[flagColor]
                    })
                });
            });
            
            Promise.all(savePromises)
                .then(function(responses) {
                    const allSucceeded = responses.every(function(r) {
                        return r.ok || r.status === 200;
                    });
                    
                    if (allSucceeded) {
                        alert('Flag preferences saved successfully!');
                        // Optionally reload to see updated labels
                        window.location.reload();
                    } else {
                        alert('Error saving flag preferences. Please try again.');
                    }
                })
                .catch(function(error) {
                    console.error('Error saving flag preferences:', error);
                    alert('Error saving flag preferences. Please try again.');
                });
        });
    }
});

// Bill tabs functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('.bill-tab');
  const tabContents = document.querySelectorAll('.bill-tab-content');
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all tabs
      tabs.forEach(function(t) {
        t.classList.remove('active');
      });
      
      // Hide all tab contents
      tabContents.forEach(function(content) {
        content.style.display = 'none';
      });
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Show corresponding tab content
      const targetContent = document.getElementById(targetTab + '-tab');
      if (targetContent) {
        targetContent.style.display = 'block';
      }
    });
  });
});

// Bill tabs functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('.bill-tab');
  const tabContents = document.querySelectorAll('.bill-tab-content');
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all tabs
      tabs.forEach(function(t) {
        t.classList.remove('active');
      });
      
      // Hide all tab contents
      tabContents.forEach(function(content) {
        content.style.display = 'none';
      });
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Show corresponding tab content
      const targetContent = document.getElementById(targetTab + '-tab');
      if (targetContent) {
        targetContent.style.display = 'block';
      }
    });
  });
});