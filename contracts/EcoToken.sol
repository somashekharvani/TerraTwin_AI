// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EcoToken is ERC20, Ownable {
    constructor() ERC20("EcoToken", "ECO") Ownable(msg.sender) {
        // Mint initial supply of 1,000,000 ECO to the deployer
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    /**
     * @dev Mints new ECO tokens to a specific address. Restricted to the owner (the backend controller wallet).
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint (including decimal precision).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
