const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/**
 * This class maintains the list of individual Story instances
 *  It also has some methods for fetching, adding, and removing stories
 */

class StoryList {
  constructor(stories) {
    this.stories = stories;
  }

  /**
   * This method is designed to be called to generate a new StoryList.
   *  It:
   *  - calls the API
   *  - builds an array of Story instances
   *  - makes a single StoryList instance out of that
   *  - returns the StoryList instance.*
   */

  // TODO: Note the presence of `static` keyword: this indicates that getStories
  // is **not** an instance method. Rather, it is a method that is called on the
  // class directly. Why doesn't it make sense for getStories to be an instance method?

  static async getStories() {
    // query the /stories endpoint (no auth required)
    const response = await axios.get(`${BASE_URL}/stories`);

    // turn the plain old story objects from the API into instances of the Story class
    const stories = response.data.stories.map(story => new Story(story));

    // build an instance of our own class using the new array of stories
    const storyList = new StoryList(stories);
    return storyList;
  }


  /**
   * Method to make a POST request to /stories and add the new story to the list
   * - user - the current instance of User who will post the story
   * - newStory - a new story object for the API with title, author, and url
   *
   * Returns the new story object
   */

  async addStory(user, newStory) {
    
    // config for axios request
    let config = {
      method: "POST",
      url: `${BASE_URL}/stories`,
      data: {
        token: user.loginToken,
        story: newStory,
      }
    }
    
    // send post request
    const res = await axios(config);

    // turn the received story object into a Story instance
    newStory = new Story(res.data.story);

    // add the story to the beginning of the stories list
    this.stories.unshift(newStory);

    // add the story to the beginning of the user's stories list (stored in the user object)
    user.ownStories.unshift(newStory);

    return newStory;
  }


  async removeStory(user, storyId) {
    
    const res = await axios.delete(`${BASE_URL}/stories/${storyId}`, { 
      data: {token: user.loginToken}
    });

    // remove the deleted story from the stories list
    this.stories = this.stories.filter(story => story.storyId !== storyId);

    // remove the deleted story from the user's stories list 
    user.ownStories = user.ownStories.filter(s => s.storyId !== storyId);
  }

}


/**
 * The User class to primarily represent the current user.
 *  There are helper methods to signup (create), login, and getLoggedInUser
 */

class User {
  constructor(userObj) {
    this.username = userObj.username;
    this.name = userObj.name;
    this.createdAt = userObj.createdAt;
    this.updatedAt = userObj.updatedAt;

    // these are all set to defaults, not passed in by the constructor
    this.loginToken = "";
    this.favorites = [];
    this.ownStories = [];
  }

  // create and return a new user object
  static async create(username, password, name) {
    try {
      // send a post request to create user
      const response = await axios.post(`${BASE_URL}/signup`, {
        user: {
          username,
          password,
          name
        }
      });

      console.log(response);

      // validate API response
      if (response.status !== 201 || !response.data) {
        throw "Unexpected API Error.";
      }

      // build a new User instance from the API response (response.data.user is the user object returned from API)
      const newUser = new User(response.data.user);

      // attach the token to the newUser instance for convenience
      newUser.loginToken = response.data.token;

      return newUser;
    } catch(err) {
      if (err.response.status === 409) {
        throw "Error - Username Already Taken.";
      } else {
        throw "Unknown API Error.";
      } 
    } 
  }

  // login user, return a new user object containing that user's information including their favorites and own stories
  static async login(username, password) {
    try {
      // send a post request to login
      const response = await axios.post(`${BASE_URL}/login`, {
        user: {
          username,
          password
        }
      });

      // validate API response
      if (response.status !== 200 || !response.data) {
        throw "Unexpected API Error.";
      }

      // build a new User instance from the API response (response.data.user is the user object returned from API)
      const existingUser = new User(response.data.user);

      // instantiate Story instances for the user's favorites and ownStories
      existingUser.favorites = response.data.user.favorites.map(s => new Story(s));
      existingUser.ownStories = response.data.user.stories.map(s => new Story(s));

      // attach the token to the newUser instance for convenience
      existingUser.loginToken = response.data.token;

      return existingUser;
    } catch(err) {
        if (err.response.status === 401) {
          console.log(err);
          throw "Error - Incorrect User Credentials";
        } else {
            console.log(err);
            throw "Unknown API Error.";
        }
    }
  }

  /** Get user instance for the logged-in-user.
   *
   * This function uses the token & username to make an API request to get details
   *   about the user. Then it creates an instance of user with that info.
   */

  static async getLoggedInUser(token, username) {
    // if we don't have user info, return null
    if (!token || !username) return null;

    // call the API
    const response = await axios.get(`${BASE_URL}/users/${username}`, {
      params: {
        token
      }
    });

    // instantiate the user from the API information
    const existingUser = new User(response.data.user);

    // attach the token to the newUser instance for convenience
    existingUser.loginToken = token;

    // instantiate Story instances for the user's favorites and ownStories
    existingUser.favorites = response.data.user.favorites.map(s => new Story(s));
    existingUser.ownStories = response.data.user.stories.map(s => new Story(s));

    return existingUser;
  }

  async addFavoriteStory(storyId) {
    const res = await axios.post(`${BASE_URL}/users/${this.username}/favorites/${storyId}`, {
      token: this.loginToken
    });

    await this.retrieveDetails();
    return this;
  }
  
  async deleteFavoriteStory(storyId) {
    const res = await axios.delete(`${BASE_URL}/users/${this.username}/favorites/${storyId}`, {
      data: {token: this.loginToken}
    });

    await this.retrieveDetails();
    return this;
  }


  async retrieveDetails() {
    const res = await axios.get(`${BASE_URL}/users/${this.username}`, {
      params: {
        token: this.loginToken
      }
    });

    // update all of the user's properties from the API response
    this.name = res.data.user.name;
    this.createdAt = res.data.user.createdAt;
    this.updatedAt = res.data.user.updatedAt;

    // remember to convert the user's favorites and ownStories into instances of Story
    this.favorites = res.data.user.favorites.map(s => new Story(s));
    this.ownStories = res.data.user.stories.map(s => new Story(s));

    return this;
  }


  async updateUserInfo(username) {
    // config for axios request
    let config = {
      url: `${BASE_URL}/users/${this.username}`,
      method: "PATCH",
      data: {
        token: this.loginToken,
        user: { 
          name: username,
        } 
      }
    }  

    // send patch request
    const res = await axios(config);

    this.name = res.data.user.name;

    return this;
  }


  async deleteUserAccount() {
    let config = {
      url: `${BASE_URL}/users/${this.username}`,
      method: "DELETE",
      data: {
        token: this.loginToken
      }
    }

    const res = await axios(config);

  }

  // update a single story
  async updateStory(user, storyId, newStory) {
    // config for axios request
    let config = {
      url: `${BASE_URL}/stories/${storyId}`,
      method: "PATCH",
      data: {
        token: user.loginToken,
        story: newStory
      }
    }

    // send patch request
    
    const res = await axios(config);

    // destructure
    const { author, title, url, updatedAt } = res.data.story;

    this.author = author;
    this.title = title;
    this.url = url;
    this.updatedAt = updatedAt;

    return this;
  }
}

/**
 * Class to represent a single story.
 */

class Story {

  /**
   * The constructor is designed to take an object for better readability / flexibility
   * - storyObj: an object that has story properties in it
   */

  constructor(storyObj) {
    this.author = storyObj.author;
    this.title = storyObj.title;
    this.url = storyObj.url;
    this.username = storyObj.username;
    this.storyId = storyObj.storyId;
    this.createdAt = storyObj.createdAt;
    this.updatedAt = storyObj.updatedAt;
  }
}