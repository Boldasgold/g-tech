/**
 * G-TECH Serviços Automotivos — Script Principal
 * Especialista: Giovane Ribeiro | Paranaguá - PR
 * WhatsApp Oficial: +55 41 9652-2715
 */

const WHATSAPP_NUMBER = "554196522715";

const wizardState = {
    currentStep: 1,
    service: "",
    brand: "",
    modelYear: "",
    issue: "",
    name: "",
    phone: "",
    date: "",
    time: "",
    period: "Manhã (08h às 12h)",
    mobility: "Vou levar o veículo até a G-TECH",
    plate: ""
};

document.addEventListener("DOMContentLoaded", () => {
    initKineticLogoReveal();
    initAutomotiveBackground();
    initMobileMenu();
    initSchedulingWizard();
    initProtocolTracker();
});

/* ========== 1. LOGO LIQUID SWASH (/logo-liquid-swash) ========== */
function initKineticLogoReveal() {
    const overlay = document.getElementById("kineticLogoReveal");
    const skipBtn = document.getElementById("btnSkipReveal");
    const replayBtn = document.getElementById("btnReplayIntro");
    const barFill = document.getElementById("ecuBarFill");
    const pctText = document.getElementById("ecuPctText");
    const statusText = document.getElementById("ecuStatusText");
    const canvas = document.getElementById("revealKineticCanvas");
    const displacement = document.getElementById("liquidDisplacement");
    const turbulence = document.getElementById("liquidTurbulence");
    const logoBox = document.getElementById("liquidLogoBox");

    if (!overlay) return;

    let animFrame = null;
    let progressTimer = null;

    function startLiquidSwashCanvas() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let t = 0;

        // Gotas fluidas luminosas (azul elétrico e dourado líquido)
        const droplets = Array.from({ length: 48 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 2.2,
            vy: (Math.random() - 0.5) * 1.8,
            r: Math.random() * 5 + 2,
            color: Math.random() > 0.35 ? "rgba(0, 198, 255, 0.55)" : "rgba(255, 208, 0, 0.55)"
        }));

        function drawSwashWave(yOffset, amplitude, freq, speed, colorStop1, colorStop2, lineWidth) {
            ctx.save();
            ctx.beginPath();
            const grad = ctx.createLinearGradient(0, yOffset - amplitude, canvas.width, yOffset + amplitude);
            grad.addColorStop(0, "transparent");
            grad.addColorStop(0.25, colorStop1);
            grad.addColorStop(0.75, colorStop2);
            grad.addColorStop(1, "transparent");

            for (let x = 0; x <= canvas.width; x += 12) {
                const y =
                    yOffset +
                    Math.sin(x * freq + t * speed) * amplitude +
                    Math.cos(x * (freq * 0.6) - t * (speed * 0.8)) * (amplitude * 0.45);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = grad;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";
            ctx.shadowColor = colorStop1;
            ctx.shadowBlur = 22;
            ctx.stroke();
            ctx.restore();
        }

        function draw() {
            t += 0.045;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const cy = canvas.height * 0.46;

            // Fitas e ondas líquidas (Liquid Swash Ribbons)
            drawSwashWave(cy - 30, 55, 0.0045, 1.4, "rgba(0, 198, 255, 0.42)", "rgba(0, 102, 255, 0.38)", 18);
            drawSwashWave(cy + 25, 45, 0.0055, -1.2, "rgba(255, 208, 0, 0.36)", "rgba(0, 198, 255, 0.35)", 12);
            drawSwashWave(cy, 70, 0.0035, 1.8, "rgba(0, 140, 255, 0.25)", "rgba(255, 180, 0, 0.25)", 26);

            // Gotículas fluidas em movimento
            for (let i = 0; i < droplets.length; i++) {
                const d = droplets[i];
                d.x += d.vx + Math.sin(t + i) * 0.6;
                d.y += d.vy + Math.cos(t + i * 0.5) * 0.6;

                if (d.x < 0) d.x = canvas.width;
                if (d.x > canvas.width) d.x = 0;
                if (d.y < 0) d.y = canvas.height;
                if (d.y > canvas.height) d.y = 0;

                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = d.color;
                ctx.shadowColor = d.color;
                ctx.shadowBlur = 12;
                ctx.fill();
            }

            animFrame = requestAnimationFrame(draw);
        }
        draw();
    }

    function closeReveal() {
        overlay.classList.add("hidden");
        document.body.classList.remove("reveal-active");
        if (animFrame) cancelAnimationFrame(animFrame);
        if (progressTimer) clearInterval(progressTimer);
    }

    function runRevealSequence(durationMs = 2800) {
        overlay.classList.remove("hidden");
        document.body.classList.add("reveal-active");

        if (logoBox) {
            logoBox.style.animation = "none";
            void logoBox.offsetWidth;
            logoBox.style.animation = "ecuIgnitionReveal 1.15s cubic-bezier(0.22, 1, 0.36, 1) forwards";
        }

        const gaugeArc = document.getElementById("ecuGaugeArc");
        startLiquidSwashCanvas();

        let pct = 0;
        const stepMs = 30;
        const increment = 100 / (durationMs / stepMs);

        if (progressTimer) clearInterval(progressTimer);
        progressTimer = setInterval(() => {
            pct = Math.min(100, pct + increment);
            const rounded = Math.round(pct);
            if (barFill) barFill.style.width = `${rounded}%`;
            if (pctText) pctText.textContent = `${rounded}%`;

            // Anima o arco de ignição digital ECU / RPM ao redor da logo
            if (gaugeArc) {
                const offset = Math.max(0, 900 - (pct / 100) * 900);
                gaugeArc.setAttribute("stroke-dashoffset", offset.toFixed(0));
            }

            if (statusText) {
                if (rounded < 35) statusText.textContent = "IGNIÇÃO DIGITAL ECU & TELEMETRIA G-TECH...";
                else if (rounded < 75) statusText.textContent = "SINCRONIZANDO SCANNER & INJEÇÃO ELETRÔNICA...";
                else statusText.textContent = "SISTEMA G-TECH PRONTO PARA ATENDIMENTO!";
            }

            if (pct >= 100) {
                clearInterval(progressTimer);
                setTimeout(closeReveal, 320);
            }
        }, stepMs);
    }

    const isRevealRoute =
        window.location.pathname.includes("logo-liquid-swash") ||
        window.location.pathname.includes("logo-kinetic-reveal") ||
        window.location.search.includes("reveal=");
    runRevealSequence(isRevealRoute ? 3400 : 2100);

    if (skipBtn) skipBtn.addEventListener("click", closeReveal);
    if (replayBtn) replayBtn.addEventListener("click", () => runRevealSequence(3200));

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
            closeReveal();
        }
    });
}

/* ========== 2. BACKGROUND AUTOMOTIVO (AZUL ELÉTRICO + DOURADO) ========== */
function initAutomotiveBackground() {
    const canvas = document.getElementById("cyberCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const nodes = Array.from({ length: 48 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
        type: Math.random() > 0.25 ? "blue" : "gold"
    }));

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0) n.x = canvas.width;
            if (n.x > canvas.width) n.x = 0;
            if (n.y < 0) n.y = canvas.height;
            if (n.y > canvas.height) n.y = 0;

            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = n.type === "gold" ? "rgba(255, 208, 0, 0.45)" : "rgba(0, 198, 255, 0.4)";
            ctx.fill();

            for (let j = i + 1; j < nodes.length; j++) {
                const n2 = nodes[j];
                const dist = Math.hypot(n.x - n2.x, n.y - n2.y);
                if (dist < 130) {
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(n2.x, n2.y);
                    ctx.strokeStyle = `rgba(0, 153, 255, ${(1 - dist / 130) * 0.14})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

/* ========== 3. MENU DE 3 PONTINHOS (LADO ESQUERDO) ========== */
function initMobileMenu() {
    const toggle = document.getElementById("menuToggle");
    const nav = document.getElementById("navLinks");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = nav.classList.toggle("open");
        toggle.classList.toggle("active", isOpen);
    });

    nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            nav.classList.remove("open");
            toggle.classList.remove("active");
        });
    });

    document.addEventListener("click", (e) => {
        if (!nav.contains(e.target) && !toggle.contains(e.target)) {
            nav.classList.remove("open");
            toggle.classList.remove("active");
        }
    });
}

/* ========== 4. WIZARD DE AGENDAMENTO RÁPIDO (3 ETAPAS: VEÍCULO -> AGENDAMENTO -> RESUMO) ========== */
function initSchedulingWizard() {
    const fill = document.getElementById("progressFill");
    const ind1 = document.getElementById("indStep1");
    const ind2 = document.getElementById("indStep2");
    const ind3 = document.getElementById("indStep3");

    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const step3 = document.getElementById("step3");

    const brandQuickBtns = document.querySelectorAll(".brand-chip-btn");
    const symptomChips = document.querySelectorAll(".symptom-chip");

    const vehicleBrand = document.getElementById("vehicleBrand");
    const vehicleModelYear = document.getElementById("vehicleModelYear");
    const vehicleIssue = document.getElementById("vehicleIssue");

    const clientName = document.getElementById("clientName");
    const clientPhone = document.getElementById("clientPhone");
    const scheduleDate = document.getElementById("scheduleDate");
    const scheduleTime = document.getElementById("scheduleTime");
    const schedulePeriod = document.getElementById("schedulePeriod");
    const vehicleMobility = document.getElementById("vehicleMobility");
    const vehiclePlate = document.getElementById("vehiclePlate");
    const summaryDetailsBox = document.getElementById("summaryDetailsBox");

    // Limitar a data mínima para hoje
    if (scheduleDate) {
        const todayStr = new Date().toISOString().split("T")[0];
        scheduleDate.min = todayStr;
        if (!scheduleDate.value) {
            scheduleDate.value = todayStr;
        }
    }

    const successModal = document.getElementById("successModal");
    const protocolDisplay = document.getElementById("protocolDisplay");
    const modalCloseBtn = document.getElementById("modalCloseBtn");
    let whatsappRedirectUrl = "";

    // Máscara de telefone WhatsApp
    if (clientPhone) {
        clientPhone.addEventListener("input", (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 6) e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
            else if (v.length > 2) e.target.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
            else if (v.length > 0) e.target.value = `(${v}`;
            else e.target.value = "";
        });
    }

    // Botões rápidos de Marca do Veículo
    brandQuickBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            brandQuickBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const brand = btn.getAttribute("data-brand") || "";
            if (vehicleBrand && brand) {
                vehicleBrand.value = brand;
            }
            if (vehicleModelYear) {
                vehicleModelYear.focus();
            }
        });
    });

    if (vehicleBrand) {
        vehicleBrand.addEventListener("change", () => {
            brandQuickBtns.forEach((b) => {
                b.classList.toggle("active", b.getAttribute("data-brand") === vehicleBrand.value);
            });
        });
    }

    // Botões interativos de Luzes do Painel ("Que luz acendeu no seu painel?")
    const dashLightBtns = document.querySelectorAll(".dash-light-btn");
    dashLightBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            btn.classList.toggle("active");
            const alertText = btn.getAttribute("data-alert");
            if (!vehicleIssue || !alertText) return;

            let current = vehicleIssue.value.trim();
            if (btn.classList.contains("active")) {
                vehicleIssue.value = current ? `${current}; ${alertText}` : alertText;
            } else {
                vehicleIssue.value = current
                    .replace(new RegExp(`;?\\s*${alertText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), "")
                    .replace(/^;\s*/, "")
                    .trim();
            }
            vehicleIssue.focus();
        });
    });

    // Etapa 1 -> Etapa 2
    document.getElementById("btnGoToStep2")?.addEventListener("click", () => {
        if (!vehicleBrand.value) {
            alert("Por favor, selecione a marca do veículo.");
            vehicleBrand.focus();
            return;
        }
        if (!vehicleModelYear.value.trim()) {
            alert("Por favor, informe o modelo e ano do veículo.");
            vehicleModelYear.focus();
            return;
        }
        if (vehicleIssue.value.trim().length < 3) {
            vehicleIssue.closest(".form-group")?.classList.add("has-error");
            vehicleIssue.focus();
            return;
        }
        vehicleIssue.closest(".form-group")?.classList.remove("has-error");

        wizardState.brand = vehicleBrand.value;
        wizardState.modelYear = vehicleModelYear.value.trim();
        wizardState.issue = vehicleIssue.value.trim();

        goToStep(2);
    });

    // Etapa 2 -> Voltar para Etapa 1
    document.getElementById("btnBackToStep1")?.addEventListener("click", () => goToStep(1));

    // Etapa 2 -> Etapa 3 (Resumo)
    document.getElementById("btnGoToStep3")?.addEventListener("click", () => {
        const nameOk = clientName.value.trim().length >= 2;
        const phoneDigits = clientPhone.value.replace(/\D/g, "");
        const phoneOk = phoneDigits.length >= 10;
        const dateOk = scheduleDate ? scheduleDate.value.trim().length > 0 : true;
        const timeOk = scheduleTime ? scheduleTime.value.trim().length > 0 : true;

        clientName.closest(".form-group")?.classList.toggle("has-error", !nameOk);
        clientPhone.closest(".form-group")?.classList.toggle("has-error", !phoneOk);
        scheduleDate?.closest(".form-group")?.classList.toggle("has-error", !dateOk);
        scheduleTime?.closest(".form-group")?.classList.toggle("has-error", !timeOk);

        if (!nameOk || !phoneOk || !dateOk || !timeOk) return;

        wizardState.name = clientName.value.trim();
        wizardState.phone = clientPhone.value.trim();
        wizardState.date = scheduleDate ? scheduleDate.value : "";
        wizardState.time = scheduleTime ? scheduleTime.value : "";
        wizardState.period = schedulePeriod.value;
        wizardState.mobility = vehicleMobility.value;
        wizardState.plate = vehiclePlate.value.trim().toUpperCase() || "Não informada";

        renderSummary();
        goToStep(3);
    });

    // Etapa 3 -> Voltar para Etapa 2
    document.getElementById("btnBackToStep2")?.addEventListener("click", () => goToStep(2));

    // Formatar data para padrão brasileiro (DD/MM/AAAA)
    function formatDateBr(isoDate) {
        if (!isoDate) return "A combinar";
        const parts = isoDate.split("-");
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return isoDate;
    }

    // Etapa 3 -> Confirmar Agendamento no WhatsApp
    document.getElementById("btnSubmitWizard")?.addEventListener("click", () => {
        const protocol = generateProtocol();
        if (protocolDisplay) protocolDisplay.textContent = protocol;

        const dataFormatada = formatDateBr(wizardState.date);
        const horarioEscolhido = wizardState.time || "A combinar";

        const msg =
            `⚡ *AGENDAMENTO RÁPIDO — G-TECH SERVIÇOS AUTOMOTIVOS*\n` +
            `🔖 *Protocolo:* ${protocol}\n\n` +
            `📅 *Data Agendada:* ${dataFormatada}\n` +
            `⏰ *Horário:* ${horarioEscolhido}\n` +
            `🕒 *Turno / Urgência:* ${wizardState.period}\n\n` +
            `🚗 *Marca do Veículo:* ${wizardState.brand}\n` +
            `🚘 *Modelo / Ano:* ${wizardState.modelYear}\n` +
            `🪪 *Placa:* ${wizardState.plate}\n` +
            `📋 *Sintomas / Solicitação:* ${wizardState.issue}\n\n` +
            `👤 *Cliente:* ${wizardState.name}\n` +
            `📱 *WhatsApp:* ${wizardState.phone}\n` +
            `🚙 *Situação:* ${wizardState.mobility}`;

        whatsappRedirectUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
        if (successModal) successModal.classList.add("active");
    });

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", () => {
            successModal.classList.remove("active");
            if (whatsappRedirectUrl) window.open(whatsappRedirectUrl, "_blank");
            goToStep(1);
        });
    }

    function renderSummary() {
        if (!summaryDetailsBox) return;
        const dataFormatada = formatDateBr(wizardState.date);
        const horarioEscolhido = wizardState.time || "A combinar";

        summaryDetailsBox.innerHTML = `
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">Data Agendada</span>
                    <span class="summary-value" style="color: var(--gold); font-weight: 800;">📅 ${dataFormatada}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Horário Desejado</span>
                    <span class="summary-value" style="color: var(--blue-bright); font-weight: 800;">⏰ ${horarioEscolhido}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Marca do Veículo</span>
                    <span class="summary-value" style="color: var(--gold);">${wizardState.brand}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Modelo / Ano</span>
                    <span class="summary-value">${wizardState.modelYear}</span>
                </div>
                <div class="summary-item" style="grid-column: 1 / -1;">
                    <span class="summary-label">Sintoma / Descrição</span>
                    <span class="summary-value">"${wizardState.issue}"</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Cliente</span>
                    <span class="summary-value">${wizardState.name}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">WhatsApp</span>
                    <span class="summary-value">${wizardState.phone}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Período / Urgência</span>
                    <span class="summary-value">${wizardState.period}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Situação</span>
                    <span class="summary-value">${wizardState.mobility}</span>
                </div>
            </div>
        `;
    }

    function goToStep(step) {
        wizardState.currentStep = step;
        [step1, step2, step3].forEach((el, idx) => {
            if (el) el.classList.toggle("active", idx + 1 === step);
        });
        [ind1, ind2, ind3].forEach((el, idx) => {
            if (el) el.classList.toggle("active", idx + 1 <= step);
        });
        if (fill) fill.style.width = `${Math.round((step / 3) * 100)}%`;
    }
}

function generateProtocol() {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `GT-${year}-${rand}`;
}

/* ========== 5. CONSULTA DE PROTOCOLO ========== */
function initProtocolTracker() {
    const btn = document.getElementById("btnTrackProtocol");
    const input = document.getElementById("protocolInput");
    if (!btn || !input) return;

    btn.addEventListener("click", () => {
        const code = input.value.trim().toUpperCase();
        if (!code) {
            alert("Digite o número do seu protocolo (Ex: GT-2026-1234).");
            input.focus();
            return;
        }
        const msg = `Olá Giovane! Gostaria de consultar o andamento do meu protocolo de atendimento *${code}* na G-TECH Serviços Automotivos.`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    });
}

/* ========== 6. ASSISTENTE G-TECH (IA) ========== */
function initAiAssistant() {
    const toggleBtn = document.getElementById("aiChatToggleBtn");
    const closeBtn = document.getElementById("aiChatCloseBtn");
    const chatWin = document.getElementById("aiChatWindow");
    const chatForm = document.getElementById("aiChatForm");
    const chatInput = document.getElementById("aiChatInput");
    const chatMessages = document.getElementById("aiChatMessages");
    const modelStatus = document.getElementById("aiChatModelStatus");

    if (!toggleBtn || !chatWin || !chatForm || !chatInput || !chatMessages) return;

    const history = [];

    toggleBtn.addEventListener("click", () => {
        const isOpen = chatWin.style.display === "flex";
        chatWin.style.display = isOpen ? "none" : "flex";
        if (!isOpen) setTimeout(() => chatInput.focus(), 80);
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            chatWin.style.display = "none";
        });
    }

    function appendBubble(text, isUser) {
        const div = document.createElement("div");
        div.style.alignSelf = isUser ? "flex-end" : "flex-start";
        div.style.background = isUser ? "#0088ff" : "#101d36";
        div.style.color = "#fff";
        div.style.border = isUser ? "1px solid #00c6ff" : "1px solid rgba(255, 208, 0, 0.3)";
        div.style.padding = "9px 12px";
        div.style.borderRadius = isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px";
        div.style.maxWidth = "88%";
        div.style.lineHeight = "1.45";
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = "";
        appendBubble(text, true);
        history.push({ role: "user", content: text });

        const loading = appendBubble("Analisando...", false);
        loading.style.opacity = "0.7";

        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: history })
            });
            const data = await res.json();
            const reply = (data.reply || "Chame no WhatsApp (41) 9652-2715!").replace(/\*\*/g, "");
            loading.style.opacity = "1";
            loading.textContent = reply;
            history.push({ role: "assistant", content: reply });

            if (modelStatus && data.source && data.source.startsWith("ollama:")) {
                modelStatus.textContent = `● Ollama Ativo (${data.source.replace("ollama:", "")})`;
            }
        } catch {
            loading.style.opacity = "1";
            loading.textContent = "Agende pelo painel do site ou chame direto no WhatsApp (41) 9652-2715!";
        }
    });
}

