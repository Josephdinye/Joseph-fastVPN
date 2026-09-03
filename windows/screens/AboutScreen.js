const AboutScreen = {
    render: () => `
        <div class="screen active fade-in" id="aboutRoot">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
                <div>
                    <h2 style="font-weight: 700; margin: 0; font-size: 20px; letter-spacing: -0.02em;">About</h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">App info, developer, and support</p>
                </div>
            </div>

            <!-- App identity -->
            <section class="card about-section">
                <div class="about-hero">
                    <div class="about-logo">🛡️</div>
                    <div class="about-hero-text">
                        <h3 class="about-app-name">Joseph FastVPN</h3>
                        <p class="about-version">Version 1.0.0 · Desktop</p>
                    </div>
                </div>
                <p class="about-body">
                    A personal desktop VPN client built for learning and everyday use.
                    It loads remote configurations, tests real connectivity, and routes traffic
                    through the fastest working node.
                </p>
            </section>

            <!-- Developer -->
            <section class="card about-section">
                <div class="about-section-head">
                    <div class="about-section-icon">👤</div>
                    <div>
                        <h3 class="about-section-title">Developer</h3>
                        <p class="about-section-desc">Who built this project</p>
                    </div>
                </div>
                <p class="about-body">
                    <strong>Joseph Dinye</strong> — Computer Science student at the University of the People,
                    and Bachelor’s candidate in Arts and Humanities at the Russian State University for the Humanities.
                    Aspiring software developer, data scientist, and AI / machine learning practitioner from Assin Fosu, Ghana.
                    Focused on practical tools that improve connectivity and everyday workflows.
                </p>
                <div class="about-links">
                    <a class="about-link" href="https://josephdinye.tech" target="_blank" rel="noopener noreferrer">
                        <span class="about-link-label">Portfolio</span>
                        <span class="about-link-value">josephdinye.tech</span>
                    </a>
                    <a class="about-link" href="https://www.linkedin.com/in/josephdinye" target="_blank" rel="noopener noreferrer">
                        <span class="about-link-label">LinkedIn</span>
                        <span class="about-link-value">linkedin.com/in/josephdinye</span>
                    </a>
                </div>
            </section>

            <!-- Contact -->
            <section class="card about-section about-section-last">
                <div class="about-section-head">
                    <div class="about-section-icon">✉️</div>
                    <div>
                        <h3 class="about-section-title">Contact &amp; feedback</h3>
                        <p class="about-section-desc">Bugs, ideas, or technical issues</p>
                    </div>
                </div>
                <p class="about-body">
                    Found a problem, have an improvement idea, or need help? Reach out directly:
                </p>
                <div class="about-links">
                    <a class="about-link" href="mailto:JosephDinye@my.uopeople.edu">
                        <span class="about-link-label">University email</span>
                        <span class="about-link-value">JosephDinye@my.uopeople.edu</span>
                    </a>
                    <a class="about-link" href="mailto:josephdinye9@gmail.com">
                        <span class="about-link-label">Personal email</span>
                        <span class="about-link-value">josephdinye9@gmail.com</span>
                    </a>
                </div>
                <p class="about-note">
                    Include a short description of the issue and any error messages when you write.
                </p>
            </section>

            <style>
                #aboutRoot .about-section {
                    padding: 16px 18px;
                    margin-bottom: 14px;
                    border-radius: 14px;
                }
                #aboutRoot .about-section-last { margin-bottom: 8px; }

                #aboutRoot .about-hero {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 14px;
                }
                #aboutRoot .about-logo {
                    width: 52px; height: 52px;
                    border-radius: 14px;
                    background: linear-gradient(145deg, rgba(59,130,246,0.25), rgba(37,99,235,0.12));
                    border: 1px solid rgba(59,130,246,0.3);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 24px; flex-shrink: 0;
                }
                #aboutRoot .about-app-name {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 700;
                    color: var(--text-main);
                    letter-spacing: -0.02em;
                }
                #aboutRoot .about-version {
                    margin: 4px 0 0 0;
                    font-size: 12px;
                    color: var(--text-muted);
                }

                #aboutRoot .about-section-head {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--border-color);
                }
                #aboutRoot .about-section-icon {
                    width: 36px; height: 36px;
                    border-radius: 10px;
                    background: rgba(59, 130, 246, 0.12);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; flex-shrink: 0;
                }
                #aboutRoot .about-section-title {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 650;
                    color: var(--text-main);
                }
                #aboutRoot .about-section-desc {
                    margin: 3px 0 0 0;
                    font-size: 12px;
                    color: var(--text-muted);
                    line-height: 1.35;
                }

                #aboutRoot .about-body {
                    margin: 0 0 12px 0;
                    font-size: 13px;
                    line-height: 1.55;
                    color: var(--text-main);
                    opacity: 0.92;
                }

                #aboutRoot .about-links {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                #aboutRoot .about-link {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    background: rgba(0,0,0,0.18);
                    border: 1px solid var(--border-color);
                    text-decoration: none;
                    transition: background 0.15s ease, border-color 0.15s ease;
                }
                #aboutRoot .about-link:hover {
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.35);
                }
                #aboutRoot .about-link-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                #aboutRoot .about-link-value {
                    font-size: 13px;
                    font-weight: 600;
                    color: #60a5fa;
                }

                #aboutRoot .about-note {
                    margin: 12px 0 0 0;
                    font-size: 11.5px;
                    line-height: 1.45;
                    color: var(--text-muted);
                }
            </style>
        </div>
    `,
    init: (ipcRenderer, appState) => {
        // Static screen
    }
};

module.exports = AboutScreen;