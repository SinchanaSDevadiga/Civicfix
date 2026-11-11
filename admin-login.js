function adminLogin(event) {

    event.preventDefault();

    const username =
        document.getElementById("adminUsername").value;

    const password =
        document.getElementById("adminPassword").value;

    const message =
        document.getElementById("loginMessage");


    // Demo admin credentials

    const correctUsername = "admin";
    const correctPassword = "civicfix123";


    if (
        username === correctUsername &&
        password === correctPassword
    ) {

        // Remember that the admin is logged in

        sessionStorage.setItem(
            "adminLoggedIn",
            "true"
        );


        message.textContent =
            "✅ Login successful!";


        message.style.color =
            "green";


        // Open Admin Dashboard

        setTimeout(function() {

            window.location.href =
                "admin.html";

        }, 500);


    } else {

        message.textContent =
            "❌ Incorrect username or password.";

        message.style.color =
            "red";
    }
}