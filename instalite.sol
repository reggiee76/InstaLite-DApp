// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InstaLite {
    // Structs

    // different user roles available on InstaLite
    enum UserRole { None, Basic, Creator, Business }
    enum RequestStatus { None, Open, Completed, Cancelled }
    uint256 public constant MONTHLY_SUBSCRIPTION_PRICE = 0.01 ether;

    struct Profile {        // Profile structure
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

    // Current State
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

    // Functions
    function createProfile(string calldata username, UserRole role) external {
        require(role != UserRole.None, "Invalid role");

        profiles[msg.sender] = Profile({
            username: username,
            role: role,
            exists: true
        });

        emit ProfileCreated(msg.sender, username, role);
    }

    function createPost(string calldata mediaURI, string calldata caption, bool isPremium) external returns (uint256) {
        require(profiles[msg.sender].exists, "Profile required.");
        require(bytes(mediaURI).length > 0, "Media URI required.");

        if (isPremium) {
            require(profiles[msg.sender].role == UserRole.Creator, "Only creators can post premium content.");
        }

        uint256 postID = nextPostID++;
        posts[postID] = Post({
            postID: postID,
            author: msg.sender,
            mediaURI: mediaURI,
            caption: caption,
            isPremium: isPremium,
            timeStamp: block.timestamp,
            hidden: false
        });

        userPosts[msg.sender].push(postID);

        emit PostCreated(postID, msg.sender, mediaURI, caption, isPremium);
        return postID;
    }

    function hidePost(uint256 postID) external {
        require(posts[postID].postID != 0, "Post does not exist.");
        require(posts[postID].author == msg.sender, "Not post author.");

        posts[postID].hidden = !posts[postID].hidden;

        emit PostHidden(postID, msg.sender);
    }

    function likePost(uint256 postID) external {
        require(posts[postID].postID != 0, "Post does not exist.");
        require(!posts[postID].hidden, "Post is hidden.");
        require(profiles[msg.sender].exists, "Profile required.");

        likeCount[postID] += 1;
        emit PostLiked(postID, msg.sender);
    }

    function getUserPosts(address user) external view returns (uint256[] memory) {
        return userPosts[user];
    }

    function tip(address to, uint256 postID) external payable {
        require(profiles[msg.sender].exists, "Profile required.");
        require(msg.value > 0, "No ETH sent.");
        require(profiles[to].exists, "Recipient has no profile.");
        require(to != address(0), "Invalid Recipient.");

        (bool sent, ) = payable(to).call{value: msg.value}("");
        require(sent, "Transfer failed.");

        emit Tipped(msg.sender, to, msg.value, postID);
    }

    function subscribe(address creator) external payable {
        require(profiles[msg.sender].exists, "Profile required.");
        require(profiles[creator].exists, "Creator has no profile.");
        require(profiles[creator].role == UserRole.Creator, "Target is not a creator.");

        require(msg.value == MONTHLY_SUBSCRIPTION_PRICE, "Wrong ETH amount.");

        uint256 currentExpireDate = subExpiry[creator][msg.sender];

        if (currentExpireDate < block.timestamp) {
            currentExpireDate = block.timestamp;
        }

        uint256 newExpiry = currentExpireDate + 30 days;
        subExpiry[creator][msg.sender] = newExpiry;

        (bool sent, ) = payable(creator).call{value: msg.value}("");
        require(sent, "Transfer failed.");

        emit Subscribed(msg.sender, creator, newExpiry);
    }

    function hasActiveSubscription(address creator, address subscriber) external view returns (bool) {
        return subExpiry[creator][subscriber] >= block.timestamp;
    }

    function createRequest(address creator, string calldata description) external payable {
        require(profiles[msg.sender].exists, "Profile required.");
        require(profiles[msg.sender].role == UserRole.Business, "Only business profiles can make this request.");

        require(msg.value > 0, "No ETH sent");
        require(profiles[creator].exists, "Creator has no profile.");
        require(profiles[creator].role == UserRole.Creator, "Target not a creator.");

        uint256 requestID = nextRequestID++;
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

    function completeRequest(uint256 requestID) external {
        Request storage r = requests[requestID];
        require(r.requestID != 0, "Request does not exist");
        require(r.status == RequestStatus.Open, "Not open");
        require(msg.sender == r.creator, "Not your request");

        r.status = RequestStatus.Completed;

        uint256 amount = r.amount;
        r.amount = 0;

        (bool sent, ) = payable(r.creator).call{value: amount}("");
        require(sent, "Payout failed");

        emit RequestCompleted(requestID);
    }
}