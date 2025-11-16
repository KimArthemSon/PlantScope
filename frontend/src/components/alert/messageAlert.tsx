
type props = {
    isError: boolean;
    message: string;
    setIsShow: React.Dispatch<React.SetStateAction<boolean>>;
}
export default function MessageAlert({isError, message, setIsShow}: props){
    function handleClose(){
         setTimeout(() => {
              setIsShow(false);
         }, 3000);
    }
    return (
        <div className="bg-green-500">
          <div className="" onClick={handleClose}></div>
          <div className="">{message}</div>
        </div>
    );
}