const Socket = io();
const logcontainer = document.getElementById("log-container");
const clearBtn = document.getElementById("clear");
clearBtn.addEventListener("click", () => {
  logcontainer.innerHTML = "";
});
getContainers();
async function getContainers() {
  const listWrapper = document.getElementById("listwrapper");
  const response = await fetch("/containers");
  if (response.ok) {
    const containers = await response.json();
    let html = "";
    containers.forEach((container) => {
      html += `
            <div class="p-2 border-bottom container">
              <div class="form-check">
                <input onchange="changeContainer(this);" value="${container.Id}" class="border-dark form-check-input" type="radio" name="containergroup" id="${container.Id}">
                <label class="form-check-label fw-bold text-uppercase" for="${container.Id}">${container.name}</label>
              </div>
            </div>`;
    });
    listWrapper.innerHTML = html;
    const firstContainer = listWrapper.children[0];
    if (firstContainer) {
      const radio = firstContainer.children[0].children[0];
      radio.checked = true;

      // Trigger the change event
      radio.dispatchEvent(new Event("change", { bubbles: false }));
    }
  }
}
let prevSelected;
function changeContainer(element) {
  if (prevSelected) prevSelected.classList.remove("active");
  prevSelected = element.parentElement.parentElement;
  prevSelected.classList.add("active");
  const id = element.value;
  logcontainer.innerHTML = "";
  getLog(id);
}

function getLog(id) {
  Socket.emit("container-logs", { container_id: id });
}

Socket.on("stream-logs", ({ line, type }) => {
  const pre = document.createElement("pre");
  pre.innerHTML = line;
  pre.classList.add(type);
  logcontainer.appendChild(pre);
  logcontainer.scrollTop = logcontainer.scrollHeight;
});
