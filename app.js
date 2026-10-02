"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const routes = {
  home: "home",
  family: "tree",
  travels: "travels",
  history: "ai",
  anniversary: "hobbies",
};
const legacyRoutes = { tree: "family", ai: "history", hobbies: "anniversary" };
const titles = {
  home: "Штыковы — семейный архив",
  family: "Наша семья — Штыковы",
  travels: "Путешествия — Штыковы",
  history: "История рода — Штыковы",
  anniversary: "Папе — 50 — Штыковы",
};
let activePage = "";

function closeMenu() {
  $("#mobileMenu").hidden = true;
  $(".menu-toggle").setAttribute("aria-expanded", "false");
  $(".menu-toggle").setAttribute("aria-label", "Открыть меню");
  document.body.classList.remove("menu-open");
}

function navigate() {
  if (location.hash === "#content") {
    $("#content").focus();
    return;
  }
  const hash = location.hash.slice(1);
  const route = legacyRoutes[hash] || (routes[hash] ? hash : "home");
  closeMenu();
  $$("dialog[open]")
    .reverse()
    .forEach((dialog) => dialog.close());
  $$(".page").forEach((page) => {
    const active = page.id === routes[route];
    page.hidden = !active;
    page.classList.toggle("active", active);
  });
  $$("nav a").forEach((link) => {
    if (link.hash === "#" + route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = titles[route];
  if (activePage && activePage !== route) {
    pauseMedia();
    const title = $("#" + routes[route] + " h1");
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  activePage = route;
  window.scrollTo({ top: 0, behavior: "instant" });
  if (route === "travels") {
    renderCards();
    initMap();
  }
}

$(".menu-toggle").addEventListener("click", () => {
  if (!$("#mobileMenu").hidden) {
    closeMenu();
    return;
  }
  $("#mobileMenu").hidden = false;
  $(".menu-toggle").setAttribute("aria-expanded", "true");
  $(".menu-toggle").setAttribute("aria-label", "Закрыть меню");
  document.body.classList.add("menu-open");
  $("#mobileMenu a").focus();
});
$("#mobileMenu").addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if ($("#mobileMenu").hidden) return;
  if (event.key === "Escape") {
    closeMenu();
    $(".menu-toggle").focus();
  }
  if (event.key === "Tab") {
    const items = [$(".menu-toggle"), ...$$("#mobileMenu a")];
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});
window.addEventListener("hashchange", navigate);
$$('[href="#content"]').forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#content").focus({ preventScroll: true });
  }),
);

function showDialog(dialog) {
  dialog.showModal();
  document.body.classList.add("modal-open");
}
$$("dialog").forEach((dialog) => {
  dialog
    .querySelector("[data-close]")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.toggle("modal-open", !!$("dialog[open]"));
  });
});

// Keep the existing family relationships; use initials when no portrait exists.
let familyView = matchMedia("(max-width: 760px)").matches ? "list" : "tree";
function setFamilyView(view) {
  familyView = view;
  $("#treeView").hidden = view !== "tree";
  $("#familyList").hidden = view !== "list";
  $$("[data-family-view]").forEach((button) => {
    const active = button.dataset.familyView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (view === "tree") {
    $("#familySearch").value = "";
    $("#familyEmpty").hidden = true;
  }
}
function renderFamily() {
  const query = $("#familySearch").value.trim().toLocaleLowerCase("ru");
  const list = $("#familyList");
  list.replaceChildren();
  familyMembers.forEach((person, index) => {
    if (
      !(person.name + " " + person.role).toLocaleLowerCase("ru").includes(query)
    )
      return;
    const card = document.createElement("button");
    card.className = "person-card";
    card.setAttribute("aria-label", person.name + ", " + person.role);
    const avatar = document.createElement("span");
    avatar.className = "person-avatar";
    if (person.photo) {
      const image = new Image();
      image.src = person.photo;
      image.alt = "";
      image.loading = "lazy";
      image.onerror = () => {
        avatar.textContent = person.name[0];
      };
      avatar.append(image);
    } else avatar.textContent = person.name[0];
    avatar.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    const name = document.createElement("strong"),
      role = document.createElement("small");
    name.textContent = person.name;
    role.textContent = person.role;
    label.append(name, role);
    card.append(avatar, label);
    card.addEventListener("click", () => openPerson(index));
    list.append(card);
  });
  $("#familyEmpty").hidden = !!list.childElementCount;
}
function openPerson(index) {
  const person = familyMembers[index];
  $("#personName").textContent = person.name;
  $("#personRole").textContent = person.role;
  $("#personNote").textContent = person.photo
    ? "Из семейного фотоархива."
    : "Портрет пока не добавлен в семейный архив.";
  $("#personHistory").hidden = person.name !== "Виктор";
  const wrap = $("#personPhotoWrap");
  wrap.replaceChildren();
  const initial = () => {
    const fallback = document.createElement("div");
    fallback.className = "person-initial";
    fallback.textContent = person.name[0];
    fallback.setAttribute("aria-hidden", "true");
    wrap.replaceChildren(fallback);
  };
  if (person.photo) {
    const image = new Image();
    image.src = person.photo;
    image.alt = person.name + " — семейный портрет";
    image.className = "person-portrait";
    image.onerror = () => {
      initial();
      $("#personNote").textContent = "Портрет не удалось загрузить.";
    };
    wrap.append(image);
  } else initial();
  showDialog($("#personDialog"));
}
$$("[data-family-view]").forEach((button) =>
  button.addEventListener("click", () => {
    setFamilyView(button.dataset.familyView);
    renderFamily();
  }),
);
$("#familySearch").addEventListener("input", () => {
  setFamilyView("list");
  renderFamily();
});
$$("[data-person]").forEach((node) => {
  node.addEventListener("click", () => openPerson(Number(node.dataset.person)));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPerson(Number(node.dataset.person));
    }
  });
});

// Travel cards remain usable independently of the map.
let currentContinent = "all";
function filteredPlaces() {
  const query = $("#placeSearch").value.trim().toLocaleLowerCase("ru");
  return worldPlaces.filter(
    (place) =>
      (currentContinent === "all" || place.continent === currentContinent) &&
      (place.name + " " + place.country)
        .toLocaleLowerCase("ru")
        .includes(query),
  );
}
function photoWord(count) {
  return count === 1
    ? "фотография"
    : count > 1 && count < 5
      ? "фотографии"
      : "фотографий";
}
function renderCards() {
  const places = filteredPlaces();
  $("#placeCards").replaceChildren();
  places.forEach((place) => {
    const card = document.createElement("button");
    card.className = "place-card";
    card.setAttribute(
      "aria-label",
      place.name +
        ", " +
        place.country +
        (place.current ? ", сейчас здесь" : ""),
    );
    const cover = document.createElement("span");
    cover.className = "place-cover";
    const emptyCover = () => {
      cover.classList.add("place-no-photo");
      cover.append(document.createTextNode(place.name.slice(0, 2)));
    };
    if (place.photos.length) {
      const image = new Image();
      image.src = place.photos[0];
      image.alt = "";
      image.loading = "lazy";
      image.onerror = () => {
        image.remove();
        emptyCover();
      };
      cover.append(image);
    } else emptyCover();
    const count = document.createElement("span");
    count.className = "photo-count";
    count.textContent = place.photos.length
      ? place.photos.length + " " + photoWord(place.photos.length)
      : "Фото ещё впереди";
    cover.append(count);
    if (place.current) {
      const current = document.createElement("span");
      current.className = "current-label";
      current.textContent = "СЕЙЧАС ЗДЕСЬ";
      cover.append(current);
    }
    const details = document.createElement("span");
    details.className = "place-details";
    const text = document.createElement("span"),
      name = document.createElement("span"),
      country = document.createElement("span");
    name.className = "place-name";
    name.textContent = place.name;
    country.className = "place-country";
    country.textContent = place.country;
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    text.append(name, country);
    details.append(text, arrow);
    card.append(cover, details);
    card.addEventListener("click", () => openAlbum(place));
    $("#placeCards").append(card);
  });
  $("#placeCount").textContent =
    "Показано " + places.length + " из " + worldPlaces.length;
  $("#placesEmpty").hidden = places.length > 0;
  renderMap();
}
$$("[data-continent]").forEach((button) =>
  button.addEventListener("click", () => {
    currentContinent = button.dataset.continent;
    $$("[data-continent]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderCards();
  }),
);
$("#placeSearch").addEventListener("input", renderCards);
$("#resetPlaces").addEventListener("click", () => {
  $("#placeSearch").value = "";
  $('[data-continent="all"]').click();
  $("#placeSearch").focus();
});

let mapCountries = null,
  mapLoading = false;
const continentView = {
  all: { scale: 175, center: [10, 10] },
  europe: { scale: 740, center: [22, 49] },
  russia: { scale: 560, center: [48, 55] },
  namerica: { scale: 540, center: [-95, 38] },
  asia: { scale: 470, center: [110, 24] },
};
const countryIDs = {
  Германия: 276,
  Австрия: 40,
  Болгария: 100,
  Италия: 380,
  Греция: 300,
  Турция: 792,
  Грузия: 268,
  Армения: 51,
  Россия: 643,
  США: 840,
  Вьетнам: 704,
  Таиланд: 764,
  Япония: 392,
};
async function initMap() {
  if (mapCountries || mapLoading) return;
  mapLoading = true;
  $("#mapStatus").hidden = false;
  $("#mapStatus").textContent = "Загружаем карту…";
  $("#mapRetry").hidden = true;
  try {
    if (!window.d3 || !window.topojson)
      throw new Error("Map libraries unavailable");
    const response = await fetch("assets/world.json", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Map unavailable");
    const world = await response.json();
    mapCountries = topojson.feature(world, world.objects.countries).features;
    $("#mapStatus").hidden = true;
    renderMap();
  } catch {
    $("#mapStatus").textContent =
      "Карта не загрузилась. Все места и фотографии доступны ниже.";
    $("#mapRetry").hidden = false;
  } finally {
    mapLoading = false;
  }
}
$("#mapRetry").addEventListener("click", initMap);
function renderMap() {
  if (!mapCountries) return;
  const svg = d3.select("#worldMap");
  svg.selectAll("*").remove();
  const view = continentView[currentContinent];
  const projection = d3
    .geoNaturalEarth1()
    .scale(view.scale)
    .center(view.center)
    .translate([500, 210]);
  const path = d3.geoPath().projection(projection);
  const places = filteredPlaces();
  const visited = new Set(places.map((place) => countryIDs[place.country]));
  svg
    .append("g")
    .attr("aria-hidden", "true")
    .selectAll("path")
    .data(mapCountries)
    .join("path")
    .attr("d", path)
    .attr("fill", (country) =>
      visited.has(+country.id) ? "#a3b28d" : "#d5ddcb",
    )
    .attr("stroke", "#e8ece2")
    .attr("stroke-width", 0.65);
  places.forEach((place) => {
    const [x, y] = projection([place.lon, place.lat]);
    const pin = svg
      .append("g")
      .attr("class", "map-pin")
      .attr("transform", `translate(${x},${y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", place.name + ", " + place.country);
    pin.append("circle").attr("r", 13).attr("fill", "transparent");
    if (place.current)
      pin
        .append("circle")
        .attr("r", 11)
        .attr("fill", "#84653e22")
        .attr("stroke", "#957443")
        .attr("stroke-width", 1);
    pin
      .append("circle")
      .attr("class", "pin-dot")
      .attr("r", place.current ? 5.5 : 4)
      .attr("fill", place.current ? "#926a3a" : "#3a5544")
      .attr("stroke", "#fffef9")
      .attr("stroke-width", 1.5);
    pin.append("title").text(place.name);
    const label = pin.append("g").attr("class", "pin-label");
    const width = place.name.length * 7 + 20;
    label
      .append("rect")
      .attr("x", -width / 2)
      .attr("y", -35)
      .attr("width", width)
      .attr("height", 23)
      .attr("rx", 2)
      .attr("fill", "#fffef9");
    label
      .append("text")
      .attr("y", -19)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#304a3e")
      .text(place.name);
    pin
      .on("click", () => openAlbum(place))
      .on("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAlbum(place);
        }
      });
  });
}

function openAlbum(place) {
  $("#mTitle").textContent = place.name;
  $("#mSub").textContent =
    place.country +
    (place.current ? " · Сейчас мы здесь" : " · Семейные путешествия");
  $("#albumCount").textContent = place.photos.length
    ? place.photos.length + " " + photoWord(place.photos.length) + " в альбоме"
    : "Место на нашей семейной карте";
  const grid = $("#mPhotos");
  grid.replaceChildren();
  if (!place.photos.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("h3");
    title.textContent = "Воспоминания уже есть.";
    const text = document.createElement("p");
    text.textContent = "Фотографии из этой поездки пока не добавлены в архив.";
    empty.append(title, text);
    grid.append(empty);
  }
  place.photos.forEach((src, index) => {
    const button = document.createElement("button");
    button.setAttribute(
      "aria-label",
      "Открыть фотографию " + (index + 1) + ": " + place.name,
    );
    const image = new Image();
    image.src = src;
    image.alt =
      place.name + " — фотография " + (index + 1) + " из семейного архива";
    image.onerror = () => {
      image.remove();
      button.textContent = "Фото не загрузилось";
      button.disabled = true;
    };
    button.append(image);
    button.addEventListener("click", () =>
      openLightbox(place.photos, index, place.name),
    );
    grid.append(button);
  });
  showDialog($("#placeDialog"));
}
$$("[data-place-name]").forEach((button) =>
  button.addEventListener("click", () =>
    openAlbum(
      worldPlaces.find((place) => place.name === button.dataset.placeName),
    ),
  ),
);

let lbPhotos = [],
  lbIndex = 0,
  lbTitle = "";
function updateLightbox() {
  const image = $("#lbImg");
  image.hidden = false;
  $("#lbError").hidden = true;
  image.alt = lbTitle + " — фотография " + (lbIndex + 1);
  image.src = lbPhotos[lbIndex];
  $("#lbCaption").textContent =
    lbTitle + " · " + (lbIndex + 1) + " / " + lbPhotos.length;
  $$(".lightbox-prev,.lightbox-next").forEach((button) => {
    button.hidden = lbPhotos.length < 2;
  });
}
function openLightbox(photos, index, title) {
  if (!photos.length) return;
  lbPhotos = photos;
  lbIndex = index;
  lbTitle = title;
  updateLightbox();
  showDialog($("#lightbox"));
}
function lbNav(direction) {
  lbIndex = (lbIndex + direction + lbPhotos.length) % lbPhotos.length;
  updateLightbox();
}
$("#lbImg").addEventListener("error", () => {
  $("#lbImg").hidden = true;
  $("#lbError").hidden = false;
});
$(".lightbox-prev").addEventListener("click", () => lbNav(-1));
$(".lightbox-next").addEventListener("click", () => lbNav(1));
$("#lightbox").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    lbNav(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    lbNav(1);
  }
});
let touchStart = null;
$("#lightbox").addEventListener(
  "touchstart",
  (event) => {
    touchStart =
      event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
  },
  { passive: true },
);
$("#lightbox").addEventListener(
  "touchend",
  (event) => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x,
      dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
      lbNav(dx < 0 ? 1 : -1);
    touchStart = null;
  },
  { passive: true },
);
$$("[data-photo]").forEach((button) =>
  button.addEventListener("click", () =>
    openLightbox([button.dataset.photo], 0, "Эскиз кепки к 50-летию"),
  ),
);

function pauseMedia() {
  $$("video").forEach((video) => {
    if (!video.paused) video.pause();
  });
  const frame = $("#youtubeContainer iframe");
  if (frame)
    frame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "https://www.youtube-nocookie.com",
    );
}
function showJubilee(index) {
  pauseMedia();
  $$("[data-jubilee]").forEach((button, i) => {
    button.setAttribute("aria-selected", String(i === index));
    button.tabIndex = i === index ? 0 : -1;
  });
  $$(".jubilee-panel").forEach((panel, i) => {
    panel.hidden = i !== index;
  });
}
$$("[data-jubilee]").forEach((button, index, buttons) => {
  button.addEventListener("click", () => showJubilee(index));
  button.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
    if (event.key === "ArrowLeft")
      next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      showJubilee(next);
      buttons[next].focus();
    }
  });
});
$("#loadVideo").addEventListener("click", () => {
  const frame = document.createElement("iframe");
  frame.title = "Видеопоздравление папе к 50-летию";
  frame.src =
    "https://www.youtube-nocookie.com/embed/qWJl66FUE-k?rel=0&enablejsapi=1";
  frame.allow =
    "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  $("#youtubeContainer").className = "youtube-player";
  $("#youtubeContainer").replaceChildren(frame);
  frame.focus();
});
$$("video").forEach((video) =>
  video.addEventListener("error", () => {
    video.hidden = true;
    video.parentElement.querySelector(".media-error").hidden = false;
  }),
);

// This is explicitly a local draft, not a submission to an absent backend.
const memoryKey = "shtykov-family-memory-v1";
function readMemory() {
  return {
    person: $("#memoryName").value.trim(),
    story: $("#memoryText").value.trim(),
  };
}
function validMemory() {
  const data = readMemory();
  $("#memoryName").setCustomValidity(
    data.person ? "" : "Укажите имя близкого человека.",
  );
  $("#memoryText").setCustomValidity(
    data.story.length >= 10 ? "" : "Добавьте хотя бы 10 символов воспоминания.",
  );
  return $("#memoryForm").reportValidity();
}
[$("#memoryName"), $("#memoryText")].forEach((input) =>
  input.addEventListener("input", () => {
    input.setCustomValidity("");
    $("#memoryStatus").textContent = "Есть несохранённые изменения.";
  }),
);
$("#memoryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validMemory()) return;
  try {
    localStorage.setItem(memoryKey, JSON.stringify(readMemory()));
    $("#memoryStatus").textContent =
      "Черновик сохранён в этом браузере. Он не опубликован на сайте.";
  } catch {
    $("#memoryStatus").textContent =
      "Браузер не разрешил сохранение. Скачайте текст, чтобы не потерять его.";
  }
});
$("#downloadMemory").addEventListener("click", () => {
  if (!validMemory()) return;
  const data = readMemory();
  const blob = new Blob(
    ["Семейный архив Штыковых\n\n" + data.person + "\n\n" + data.story + "\n"],
    { type: "text/plain;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "Семейное воспоминание.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#memoryStatus").textContent =
    "Текст подготовлен для скачивания. На сайте он не опубликован.";
});
try {
  const saved = JSON.parse(localStorage.getItem(memoryKey));
  if (
    saved &&
    typeof saved.person === "string" &&
    typeof saved.story === "string"
  ) {
    $("#memoryName").value = saved.person.slice(0, 100);
    $("#memoryText").value = saved.story.slice(0, 12000);
    $("#memoryStatus").textContent = "Восстановлен черновик из этого браузера.";
  }
} catch {
  /* Private browsing may disallow storage; the download still works. */
}

$("#placesCount").textContent = worldPlaces.length;
$("#countriesCount").textContent = new Set(
  worldPlaces.map((place) => place.country),
).size;
renderFamily();
setFamilyView(familyView);
navigate();
