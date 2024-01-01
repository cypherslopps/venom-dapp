'use client';

import { useEffect, useState, React } from 'react';
import { Address } from "everscale-inpage-provider";
import { IoIosArrowDown } from 'react-icons/io';
import { RiLoader3Fill } from "react-icons/ri";
import BigNumber from 'bignumber.js';
import { toast } from 'react-toastify';
import { useVenomConnect } from '../providers/VenomConnectProvider';
import tokenRootAbi from "../abi/TokenRoot.abi.json";
import tokenWalletAbi from "../abi/TokenWallet.abi.json";
import TokenPopup from './TokenPopup';
import { tokenData, recipientAddress } from '../constants';
import { axios } from "../utils/axios";
import { getValueForSend } from '../utils/helpers';


const TransferToken = () => {
  const { address, venomProvider, venomConnect } = useVenomConnect();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedToken, setSelectedToken] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenBalanceLoading, setIsTokenBalanceLoading] = useState(false);
  const [tokenToTransferAmount, setTokenToTransferAmount] = useState("");
  let tokenWalletAddress;

  useEffect(() => {
    setSelectedToken(tokenData[0]);

    return () => setSelectedToken({});
  }, [])

  const togglePopup = () => {
    setShowPopup(!showPopup);
  };

  const handleOverlayClick = () => {
    setShowPopup(false);
  };

  const handleListItemClick = (activeToken) => {
    setSelectedToken({
      ...selectedToken,
      ...activeToken
    });
    setShowPopup(false);
  };

  // This method calls balance function of deployed TokenWallet smart contract (can be called with standalone client as provider)
  const setupTokenWalletAddress = async (standalone, wallet) => {
    try {
      const tokenRootContractAddress = new Address(selectedToken.rootAddress);
      const tokenRootContract = new standalone.Contract(tokenRootAbi, tokenRootContractAddress);

      const tokenWallet = (await tokenRootContract.methods.walletOf({
        answerId: 0,
        walletOwner: wallet
      }).call());

      if(!tokenWallet) return undefined;
      tokenWalletAddress = tokenWallet.value0._address;

      return tokenWalletAddress;
    } catch(err) {
      console.error(err);
    }
  }

  const setupTokenWalletContract = async (wallet) => {
    if(!venomConnect) return;
    const standalone = await venomConnect?.getStandalone('venomwallet');

    if(standalone) {
      if(!tokenWalletAddress) {
        await setupTokenWalletAddress(standalone, wallet);
      }
  
      if(!venomProvider || !tokenWalletAddress) return;
  
      try {
        const contractAddress = new Address(tokenWalletAddress);
        const contract = new standalone.Contract(tokenWalletAbi, contractAddress);
        
        return contract;
      } catch(e) {
        console.error(e.message);
      }
    } else {
      console.error("Standalone is not available now");
    }
  }

  // Fetch user token balance
  const getUserTokenBalance = async () => {
    try {
      setIsTokenBalanceLoading(true);

      const tokenWalletContract = await setupTokenWalletContract(address);

      const result = await tokenWalletContract.methods.balance({ answerId: 0 }).call();
      const tokenBalance = result.value0;
      const tokenDecimalBalance = tokenBalance / (10**selectedToken.decimals);
      
      if(tokenDecimalBalance) {
        // Set Token Balance
        setTokenBalance(tokenDecimalBalance);

        setIsTokenBalanceLoading(false);
      }
    } catch(err) {
      toast.error("Failed to fetch token balance");
    }
  }

  // Burn user token
  const burnToken = async (e) => {
    e.preventDefault();

    if(tokenToTransferAmount) {
      try {
        // Display Loader
        setIsLoading(true);

        const tokenWalletContract = await setupTokenWalletContract(address);

        const amountOfTokens = new BigNumber(tokenToTransferAmount).multipliedBy(10 ** selectedToken.decimals).toString();
        const amountSent = new BigNumber(amountOfTokens).plus(new BigNumber(1).multipliedBy(10 ** 9)).toString();

        if(tokenToTransferAmount > tokenBalance) {
          toast(`Burn Token Amount is less than your ${selectedToken.name} token balance`);
        } else {
          const receipt = await tokenWalletContract.methods.transfer({
            amount: amountOfTokens,
            recipient: new Address(recipientAddress),
            deployWalletValue: 0,
            remainingGasTo: new Address(address),
            notify: true,
            payload: ""
          }).send({
            from: new Address(address),
            amount: getValueForSend(1),
            bounce: true
          });
          // const { transaction } = await venomProvider.sendMessage({
          //   sender: new Address(address),
          //   recipient: new Address(burnerAddress),
          //   amount: amountOfTokens, // 1 Native coin
          //   bounce: true,
          //   payload: ""
          // });
          
          if(!transaction.aborted) {
            try {
              const transactionHash = transaction?.id?.hash;
              const data = {
                name: selectedToken.name,
                symbol: selectedToken.symbol,
                image: `http://localhost:3000/${selectedToken.logo}`,
                userId: address,
                transaction: transactionHash
              };
  
              const transactionResponse = await axios.post("/burn", data);
              const transactionResponseData = await transactionResponse.data;
              
              if(transactionResponse.status === 200 || transactionResponseData.message === "success") {
                toast.success(`Successfully burnt ${tokenToTransferAmount} of your ${selectedToken.name} tokens.`);
              }
            } catch(err) {
              toast.error("There was an error submitting the transaction");
            }
          }
        }
      } catch(err) {
        if(err.code === 3) {
          toast.error("Transaction aborted");
        } else if(err.code === 2) {
          toast.error("Transaction is taking longer than expected");
        }
      } finally {
        // Hide Loader
        setIsLoading(false);
      }
    } else {
      // Display Error
      toast("Add an amount to burn");
    }
  }

  useEffect(() => {
    if(address && venomConnect, selectedToken.name) getUserTokenBalance();
    else
      setTokenBalance(0);
  }, [address, venomConnect, selectedToken.name]);

  // Disable burn form if user is not connected to wallet
  return (
    <div className="app-burn-container">
      <form onSubmit={(e) => address && burnToken(e)} className="burn-content-container">
        <h1>Burn Tokens</h1>
        <div className="top-value_wrapper">
          <div className="top-value">
            {/* Convert balance to actual venom balance */}
            <h5 className='flex items-center gap-2'>
              Bal: {isTokenBalanceLoading ? (
                <RiLoader3Fill className='spin spin-sm' />
              ) : (!isTokenBalanceLoading && tokenBalance) ? `${tokenBalance} ${selectedToken.symbol}` : `0 ${selectedToken.symbol}`}
            </h5>
            <div className="combobox-wrapper">
              <input
                type="number"
                id="topValueInput"
                name="tokenToTransferAmount"
                className="topValueInput"
                value={tokenToTransferAmount}
                onChange={({ target }) => setTokenToTransferAmount(target.value)}
                placeholder="0.00"
              />

              <div className="coin-box">
                <div className="coin-wrapper" onClick={togglePopup}>
                  <img src={selectedToken.logo} alt={selectedToken.name} />
                  <h1>{selectedToken.symbol}</h1>
                  <IoIosArrowDown fontSize={50} />
                </div>
              </div>
            </div>
          </div>
          <div className="coin-details_wrapper">
            <div />
          </div>
        </div>

        <button 
          id="connectWalletBtnBurn" 
          aria-disabled={!address || isLoading} 
          disabled={!address || isLoading} 
          type="submit"
        >
          {isLoading ? <RiLoader3Fill className='spin spin-sm' /> : "Burn"}
        </button>
      </form>

      {showPopup && (
        <TokenPopup
          tokens={tokenData}
          handleOverlayClick={handleOverlayClick}
          handleListItemClick={handleListItemClick}
        />
      )}

{/* <input type="file" req={fileInputRef} onChange={({ target }) => fileInputRef.current = target.files[0]} name="file" /> */}
    </div>
    
  );
};

export default TransferToken;