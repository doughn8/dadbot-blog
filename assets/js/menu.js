const container = document.querySelector(".container");
const allMenus = document.querySelectorAll(".menu");

// Hide menus on body click
document.body.addEventListener("click", () => {
  allMenus.forEach(menu => {
    if (menu.classList.contains("open")) {
      menu.classList.remove("open");
      menu.querySelector(".menu__trigger").setAttribute("aria-expanded", "false");
    }
  });
});

// Reset menus on resize
window.addEventListener("resize", () => {
  allMenus.forEach(menu => {
    menu.classList.remove("open");
    menu.querySelector(".menu__trigger").setAttribute("aria-expanded", "false");
  });
});

// Handle desktop menu
allMenus.forEach(menu => {
  const trigger = menu.querySelector(".menu__trigger");
  const dropdown = menu.querySelector(".menu__dropdown");

  trigger.addEventListener("click", e => {
    e.stopPropagation();

    if (menu.classList.contains("open")) {
      menu.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    } else {
      // Close all menus...
      allMenus.forEach(m => {
        m.classList.remove("open");
        m.querySelector(".menu__trigger").setAttribute("aria-expanded", "false");
      });
      // ...before opening the current one
      menu.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }

    if (dropdown.getBoundingClientRect().right > container.getBoundingClientRect().right) {
      dropdown.style.left = "auto";
      dropdown.style.right = 0;
    }
  });

  menu.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !menu.classList.contains("open")) return;
    e.preventDefault();
    e.stopPropagation();
    menu.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  });

  dropdown.addEventListener("click", e => e.stopPropagation());
});
