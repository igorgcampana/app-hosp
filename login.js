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

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error("Login Error:", error);

            let msg = "Email ou senha incorretos.";
            if (error.message.includes("Email not confirmed")) {
                msg = "E-mail não confirmado. Verifique sua caixa de entrada ou o painel do Supabase.";
            } else if (error.message.includes("Invalid login")) {
                msg = "Credenciais inválidas. Verifique o e-mail e a senha copiados.";
            } else {
                msg = `Erro: ${error.message}`;
            }

            errorMsg.textContent = msg;
            errorMsg.style.display = 'block';
            submitBtn.textContent = 'Entrar';
            submitBtn.disabled = false;
        } else {
            // Success, redirect to main app
            window.location.href = 'index.html';
        }
    });
});
