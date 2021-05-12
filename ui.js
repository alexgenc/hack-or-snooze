$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $body = $("body");
  const $ownFavorites = $('#favorited-articles');
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navWelcome = $("#nav-welcome")
  const $theUser = $('#nav-user-profile');
  const $userProfile = $('#user-profile');
  const $postStory = $('#postStory');
  const $mainNavLinks = $('.main-nav-links');
  const $deleteUserAccount = $('#deleteUserAccount');
  const $changeName = $('#changeName');
  const $editArticleForm = $('#edit-article-form');
  const $submitChanges = $('#submitChanges');
  
  
  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    try {
      // call the login static method to build a user instance
      const userInstance = await User.login(username, password);

      // set the global user to the user instance
      currentUser = userInstance;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
    } catch(err) {
        console.log(err);
        alert(err);
        return;
    }

    
  });

  
  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    
    
    try {
      // grab the required fields
      let name = $("#create-account-name").val();
      let username = $("#create-account-username").val();
      let password = $("#create-account-password").val();

      // call the create method, which calls the API and then builds a new user instance
      const newUser = await User.create(username, password, name);
      currentUser = newUser;
    } catch(err) {
        alert(err);
        return;
    }

    
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();

  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  // event handler for submitting a story
  $submitForm.on("submit", async function(e) {
    e.preventDefault()

    // grab the new story information from the form
    const $author = $('#author');
    const $title = $('#title');
    const $url = $('#url');
    const hostName = getHostName($url.val());
    const username = currentUser.username

    const newStory = {
      title: $title.val(),
      author: $author.val(),
      url: $url.val(),
      username
    };
    
    const storyObject = await storyList.addStory(currentUser, newStory);

    // generate markup for the new story
    const $li = $(`
      <li id="${storyObject.storyId}" class="id-${storyObject.storyId}">
        <span class="fav">  
          <i class="far fa-heart"></i>
        </span>
        <a class="article-link" href="${$url.val()}" target="a_blank">
          <strong>${$title.val()}</strong>
        </a>
        <small class="article-author">by ${$author.val()}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${username}</small>
      </li>
    `);

    // add the new story to the stories section
    $allStoriesList.prepend($li);

    // reset and hide post story form
    $submitForm.slideUp("slow");
    $submitForm.trigger("reset");
  });
  
  
  
 /**
   * Handling favorites
   *
   */

  $(".articles-container").on("click", ".fav", async function(evt) {
    if (currentUser) {
      const $tgt = $(evt.target);
      const $closestLi = $tgt.closest("li");
      const storyId = $closestLi.attr("id");

      // if the item is already favorited
      if ($tgt.hasClass("fas")) {
        // remove the favorite from the user's list
        await currentUser.deleteFavoriteStory(storyId);
        // then change the class to be an empty star
        $tgt.closest("i").toggleClass("fas far");
      } else {
        // the item is un-favorited
        await currentUser.addFavoriteStory(storyId);
        $tgt.closest("i").toggleClass("fas far");
      }
    }
  });


  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  
  // event handler for clicking username on nav bar
  $theUser.on("click", function() {
    hideElements()
    $userProfile.show();
  })

 
  // Event handler for clicking post story on the nav bar
  $postStory.on("click", function() {
    if (currentUser) {
    hideElements();
    $allStoriesList.show();
    $submitForm.show();
    }
  });


  // event handler for clicking favorites on the nav bar
  $body.on("click", "#myFavorites", function() {
    if (currentUser) {
    hideElements();  
    generateFaves();
    $ownFavorites.show();
    }
  });


  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  // event handler for clicking my stories on the nav bar
  $body.on("click", "#myStories", function() {
    if (currentUser) {
      hideElements();
      generateMyStories();
      $ownStories.show();
    }
  });


// event handler for deleting a story
 $ownStories.on("click", ".trash-can", async function(e) {
  // get the Story's ID
  const $closestLi = $(e.target).closest("li");
  const storyId = $closestLi.attr("id");

  // remove the story from the API
  await storyList.removeStory(currentUser, storyId);

  // re-generate the story list
  await generateStories();

  // hide everyhing
  hideElements();

  // ...except the story list
  $allStoriesList.show();
 });

  
/**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();
    

    if (currentUser) {
      generateProfile();
      showNavForLoggedInUser();
    }
  }
  
 
  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    if(currentUser) {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();

    // generate user profile
    generateProfile();
    }
  }
 
 
  function generateProfile() {
    $theUser.text(`${currentUser.username}`);
    $('#profile-name').text(`Name: ${currentUser.name}`);
    $('#profile-username').text(`Username: ${currentUser.username}`);
    $('#profile-account-date').text(`Account Created: ${currentUser.createdAt.slice(0,10)}`);
  }
 
 

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    
    for (let story of storyList.stories) {
          const result = generateStoryHTML(story);
          $allStoriesList.append(result);
      }
  }
 

  /**
   * A function to render HTML for an individual Story instance
   */
  function generateStoryHTML(story, ownStory) {
    let hostName = getHostName(story.url);
    let fav = isFavorite(story) ? "fas" : "far";

    // render a trash can for deleting your own story
    const trashCanIcon = ownStory
      ? `<span class="trash-can">
          <i class="fas fa-trash-alt"></i>
        </span>`
      : "";

    // render an edit button for editing your own story
    const editStoryIcon = ownStory
      ? `<span class="edit-story">
          <i class="far fa-edit"></i>
        </span>`
      : "";  

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${trashCanIcon}
        ${editStoryIcon}
        <span class="fav">
          <i class="${fav} fa-heart"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }


  function generateFaves() {
    // empty out the list by default
    $ownFavorites.empty();
    let myFavorites = currentUser.favorites;

    // if the user has no stories that they have posted
    if (myFavorites.length === 0) {
      $ownFavorites.append("<h5>No favorites added!</h5>");
    } else {
      // for all of the user's favorites
      
      for (let myFavorite of myFavorites) {
        const result = generateStoryHTML(myFavorite);
        $ownFavorites.append(result);
      }
    }
  }

  
  function generateMyStories() {
    $ownStories.empty();
    let myStories = currentUser.ownStories;

    // / if the user has no stories that they have posted
    if (myStories.length === 0) {
      $ownStories.append("<h5>No stories added by user yet!</h5>");
    } else {
      // for all of the user's posted stories
      
      for (let myStory of myStories) {
        const result = generateStoryHTML(myStory, true);
        $ownStories.append(result);
      }
    }
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfile,
      $ownFavorites
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $mainNavLinks.show();
    $navWelcome.show();
  }


  function isFavorite(story) {
    let favStoryIds = new Set();
    if (currentUser) {
      favStoryIds = new Set(currentUser.favorites.map(obj => obj.storyId));
    }
    return favStoryIds.has(story.storyId);
  }
  
  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
      let hostName;
      if (url.indexOf("://") > -1) {
        hostName = url.split("/")[2];
      } else {
        hostName = url.split("/")[0];
      }
      if (hostName.slice(0, 4) === "www.") {
        hostName = hostName.slice(4);
      }
      return hostName;
  }
  
  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }

   // after user account deletion
   function afterDeletion() {
    localStorage.clear();
    location.reload();
  }

  // handle username change
  $changeName.on("click", async function(e) {
    
    $newName = $('#newName').val();

    currentUser.updateUserInfo($newName);

    await currentUser.retrieveDetails();

    location.reload();

  });

  // handle user account deletion
  $deleteUserAccount.on("click", async function(e) {
    currentUser.deleteUserAccount()
    
    setTimeout(function() {
      alert("Account deleted. Sorry to see you go! :(");
    }, 2000);

    setTimeout(function() {
      afterDeletion()
    }, 3500);
  });

 
  // event handler for clicking edit story button
  $ownStories.on("click", ".edit-story", async function(e) {
    $editArticleForm.show();

    const $closestLi = $(e.target).closest("li");
    
    const storyId = $closestLi.attr("id");

    $author = $('#edit-author');
    $title = $('#edit-title');
    $url = $('#edit-url');
    
    $submitChanges.on("click", async function(e) {
      e.preventDefault();

      newStory = {
        author: $author.val(),
        title: $title.val(),
        url: $url.val()
      }

      await currentUser.updateStory(currentUser, storyId, newStory);
      
      location.reload();
    })
    
  });
 
})