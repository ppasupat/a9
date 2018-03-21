window.addEventListener('load', function () {
  var spoilerBoxes = document.getElementsByClassName('spoiler');
  for (var i = 0; i < spoilerBoxes.length; i++) {
    var spolierBox = spoilerBoxes[i],
        wrapper = document.createElement("div"),
        toggleWrapper = document.createElement("div"),
        toggleButton = document.createElement("button");
    spolierBox.parentElement.insertBefore(wrapper, spolierBox);
    wrapper.appendChild(toggleWrapper);
    toggleWrapper.appendChild(toggleButton);
    toggleWrapper.setAttribute('class', 'spoiler-button-wrapper');
    toggleButton.innerHTML = 'Toggle Spoiler';
    wrapper.appendChild(spolierBox);
    toggleButton.onclick = function () {
      spolierBox.style.display = 
        spolierBox.style.display == 'block' ? 'none' : 'block';
    }
  }
});
