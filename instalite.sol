// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InstaLite {
    // Structs

    // different user roles available on InstaLite
    enum UserRole { None, Basic, Creator, Business }
    enum RequestStatus { None, Open, Completed, Cancelled }
    uint256 public constant MONTHLY_SUBSCRIPTION_PRICE = 0.01 ether;

    struct Profile {        // Profile Structure
        string username;
        UserRole role;
        bool exists;
    }

    struct Post {           // Post Structure
        uint256 postID;
        address author;
        string mediaURI;
        string caption;
        uint256 timeStamp;
        bool hidden;
        bool isPremium;
    }

    struct Request {        // Request Structure
        uint256 requestID;
        address business;
        address creator;
        uint256 amount;
        RequestStatus status;
        string description;
    }

    // Current State of the InstaLite Application
    uint256 public nextPostID = 1;
    uint256 public nextRequestID = 1;

    mapping(address => Profile) public profiles;
    mapping(uint256 => Request) public requests;
    mapping(uint256 => Post) public posts;
    mapping(address => uint256[]) public userPosts;

    // Events
    event ProfileCreated(address indexed user, string username, UserRole role);
    event PostCreated(uint256 indexed postID, address indexed author, string mediaURI, string caption, bool isPremium);
    event PostHidden(uint256 indexed postID, address indexed author);
    event PostLiked(uint256 indexed postID, address indexed user);
    mapping(uint256 => uint256) public likeCount;

    event Tipped(address indexed from, address indexed to, uint256 amount, uint256 indexed postID);
    
    event Subscribed(address indexed subscriber, address indexed creator, uint256 newExpiry);
    mapping(address => mapping(address => uint256)) public subExpiry;

    event RequestCreated(uint256 indexed requestID, address indexed business, address indexed creator, uint256 amount, string description);
    event RequestCancelled(uint256 indexed requestID);
    event RequestCompleted(uint256 indexed requestID);


    // FUNCTIONS

    // Function to Create/Update a Profile (Assign a username and role to an address)
    function createProfile(string calldata username, UserRole role) external {
        // Revert the call if the role entered is not a valid role.
        require(role != UserRole.None, "Invalid role");

        // Update the user's username, role, and assert that the account now exists.
        profiles[msg.sender] = Profile({
            username: username,
            role: role,
            exists: true
        });

        emit ProfileCreated(msg.sender, username, role);
    }

    // Function to Create a Post ()
    function createPost(string calldata mediaURI, string calldata caption, bool isPremium) external returns (uint256) {
        // Revert the call if profile does not exist.
        require(profiles[msg.sender].exists, "Profile required.");

        // Revert if the user did not input the media URL.
        require(bytes(mediaURI).length > 0, "Media URI required.");

        // Check if user is uploading premium content (subscriber-only content)
        if (isPremium) {
            // Revert if the user does not have the Creator Role which is required for posting premium content.
            require(profiles[msg.sender].role == UserRole.Creator, "Only creators can post premium content.");
        }

        // Update the global postID
        uint256 postID = nextPostID++;

        // Update post parameters as given from user and initialize others
        posts[postID] = Post({
            postID: postID,
            author: msg.sender,
            mediaURI: mediaURI,
            caption: caption,
            isPremium: isPremium,
            timeStamp: block.timestamp,
            hidden: false
        });

        // Update individual user posts by postID
        userPosts[msg.sender].push(postID);

        emit PostCreated(postID, msg.sender, mediaURI, caption, isPremium);
        return postID;
    }

    // Function to Hide/Unhide a Post
    function hidePost(uint256 postID) external {
        // Revert if the postID given does not exist.
        require(posts[postID].postID != 0, "Post does not exist.");

        // Revert if the address trying to hide the post is not the post author.
        require(posts[postID].author == msg.sender, "Not post author.");

        // Set post "hidden" attribute to the opposite boolean value. Hide (true) UnHide (false)
        posts[postID].hidden = !posts[postID].hidden;

        emit PostHidden(postID, msg.sender);
    }

    // Function to Like a Post
    function likePost(uint256 postID) external {
        // Revert if the postID given does not exist.
        require(posts[postID].postID != 0, "Post does not exist.");

        // Revert if the post is hidden. Should not be able to like.
        require(!posts[postID].hidden, "Post is hidden.");

        // Revert if the profile does not exist.
        require(profiles[msg.sender].exists, "Profile required.");

        // Increase the Like Count for the given post ID
        likeCount[postID] += 1;

        emit PostLiked(postID, msg.sender);
    }

    // Function to gather a list of Post ID's for a given user (address)
    function getUserPosts(address user) external view returns (uint256[] memory) {
        return userPosts[user];
    }

    // Function to send a tip to a Creator User
    function tip(address to, uint256 postID) external payable {
        // Revert if the sender user doesn't exist.
        require(profiles[msg.sender].exists, "Profile required.");

        // Revert if the ETH sent is not greater than 0.
        require(msg.value > 0, "No ETH sent.");

        // Revert if the recipient user does not exist.
        require(profiles[to].exists, "Recipient has no profile.");

        // Revert if the recipient address does not exist. (Probably not needed.)
        // require(to != address(0), "Invalid Recipient.");

        // Revert if the recipient profile role is not a Creator.
        require(profiles[to].role == UserRole.Creator, "Only creator users can be tipped.")

        // Send tip to recipient and check for success using bool var "sent".
        (bool sent, ) = payable(to).call{value: msg.value}("");
        require(sent, "Transfer failed.");

        emit Tipped(msg.sender, to, msg.value, postID);
    }

    // Function to subscribe to a Creator User
    function subscribe(address creator) external payable {
        // Revert if the sender user profile does not exist.
        require(profiles[msg.sender].exists, "Profile required.");

        // Revert if the creator user profile does not exist.
        require(profiles[creator].exists, "Creator has no profile.");

        // Revert if the recipient of the subscription is not a Creator User.
        require(profiles[creator].role == UserRole.Creator, "Only creator users can be subscribed to.");

        // Revert if the user is not sending the correct ETH ammount for a subscription purchase.
        require(msg.value == MONTHLY_SUBSCRIPTION_PRICE, "Wrong ETH amount.");

        // Get the subscription expiration date currently on user account.
        uint256 currentExpireDate = subExpiry[creator][msg.sender];

        // Update the subscription expiration date to reflect the current date.
        if (currentExpireDate < block.timestamp) {
            currentExpireDate = block.timestamp;
        }

        // Calculate and update the new Sub Expiration date.
        uint256 newExpiry = currentExpireDate + 30 days;
        subExpiry[creator][msg.sender] = newExpiry;

        (bool sent, ) = payable(creator).call{value: msg.value}("");
        require(sent, "Transfer failed.");

        emit Subscribed(msg.sender, creator, newExpiry);
    }

    // Function to check if a user has an active subscription to a creator.
    function hasActiveSubscription(address creator, address subscriber) external view returns (bool) {
        return subExpiry[creator][subscriber] >= block.timestamp;
    }

    // Function for Business Users to create a request to a Creator User for paid (advertised) content.
    function createRequest(address creator, string calldata description) external payable {
        // Revert if the address sender does not have a profile.
        require(profiles[msg.sender].exists, "Profile required.");

        // Revert if the sender does not have a Business Profile.
        require(profiles[msg.sender].role == UserRole.Business, "Only business profiles can make this request.");

        // Revert if the ETH payment is not greater than 0.
        require(msg.value > 0, "No ETH sent");

        // Revert if the recipient address does not have a profile.
        require(profiles[creator].exists, "Recipient has no profile.");

        // Revert if the recipient is not a Creator Profile.
        require(profiles[creator].role == UserRole.Creator, "Target not a creator.");

        // Update global requestID.
        uint256 requestID = nextRequestID++;

        // Create the new request with information provided by the Business and initialize status variables.
        requests[requestID] = Request({
            requestID: requestID,
            business: msg.sender,
            creator: creator,
            amount: msg.value,
            status: RequestStatus.Open,
            description: description
        });

        emit RequestCreated(requestID, msg.sender, creator, msg.value, description);
    }

    // Function for marking a request as Completed. Creator gets paid and Business sends payment.
    function completeRequest(uint256 requestID) external {
        // Store the requestID information
        Request storage r = requests[requestID];

        // Revert if the requestID does not exist.
        require(r.requestID != 0, "Request does not exist");

        // Revert if the request staus is still open.
        require(r.status == RequestStatus.Open, "Not open");

        // Revert if the sender is not the user creator completing the request.
        require(msg.sender == r.creator, "Not your request");

        // Set the request status as completed.
        r.status = RequestStatus.Completed;

        // Save the payment amount and reset the value.
        uint256 amount = r.amount;
        r.amount = 0;

        // Send funds to recipient and check for success using bool var "sent".
        (bool sent, ) = payable(r.creator).call{value: amount}("");
        require(sent, "Payout failed");

        emit RequestCompleted(requestID);
    }
}