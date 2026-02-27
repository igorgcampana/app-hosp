const SUPABASE_URL = 'https://gbcnmuppylwznhrticfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiY25tdXBweWx3em5ocnRpY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjcwNzUsImV4cCI6MjA4NzU0MzA3NX0.XOQfcNwZSxarlHz2D51MEqlkLJ74TYLpFOUUYVB0Ko0';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-message');
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    // Check if already logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        errorMsg.style.display = 'none';
        submitBtn.textContent = 'Entrando...';
        submitBtn.disabled = true;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                let msg = `Erro: ${error.message}`;
                if (error.message.includes("Email not confirmed")) {
                    msg = "E-mail não confirmado. Verifique o painel do Supabase.";
                } else if (error.message.includes("Invalid login credentials")) {
                    msg = "E-mail ou senha incorretos.";
                }
                errorMsg.textContent = msg;
                errorMsg.style.display = 'block';
                submitBtn.textContent = 'Entrar';
                submitBtn.disabled = false;
            } else if (data?.user) {
                window.location.href = 'index.html';
            } else {
                errorMsg.textContent = 'Falha no login: resposta inesperada do servidor. Tente novamente.';
                errorMsg.style.display = 'block';
                submitBtn.textContent = 'Entrar';
                submitBtn.disabled = false;
            }
        } catch (err) {
            console.error("Fatal JS Error:", err);
            errorMsg.textContent = `Erro do Sistema: ${err.message}`;
            errorMsg.style.display = 'block';
            submitBtn.textContent = 'Entrar';
            submitBtn.disabled = false;
        }
    });
});
