const deleteProduct = btn => {
  const prodId = btn.parentNode.querySelector('[name=productId').value;
  const csrf = btn.parentNode.querySelector('[name=_csrf').value;

  const productElement = btn.closest('article');

  productElement.classList.add('relative');

  const loader = `
  <div class='loader'>
      <svg>
          <use href='../icon/icons.svg#icon-cw'></use>
      </svg>
  </div> `;

  productElement.insertAdjacentHTML('afterbegin', loader);

  fetch('/admin/product/' + prodId, {
    method: 'DELETE',
    headers: {
      'csrf-token': csrf
    }
  })
    .then(result => {
      return result.json();
    })
    .then(data => {
      console.log(data);
      const loader = document.querySelector('.loader');
      if (loader) {
        productElement.parentNode.removeChild(productElement);
      }
      //reload the page in 2 seconds
      setTimeout(function() {
        location.reload();
      }, 500); //reload after 2000 milliseconds or 2 seconds
    })
    .catch(err => {
      console.log(err);
    });
};
