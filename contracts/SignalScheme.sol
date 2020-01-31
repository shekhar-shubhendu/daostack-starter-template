pragma solidity ^0.5.11;

contract SignalScheme {
    event SignalLog(address indexed _sender, string _descriptionHash);

    function signal(string calldata _descriptionHash) external {
       emit SignalLog(msg.sender, _descriptionHash);
    }
}
