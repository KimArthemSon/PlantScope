import { Delete } from "lucide-react";

interface LogoutProps {
  setIsDeleteModalOpen: (value: boolean) => void;
  isDeleteModalOpen: boolean;
  onDelete: () => void;
}

export default function Delete_modal({
  setIsDeleteModalOpen,
  isDeleteModalOpen,
  onDelete,
}: LogoutProps) {
  return (
    <div
      className={`fixed inset-0 z-10000 flex items-center justify-center bg-black/50 transition-opacity duration-300
        ${
          isDeleteModalOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }
      `}
    >
      <div
        className={`flex flex-col items-center gap-2 bg-white rounded-lg p-6 w-80 text-center shadow-lg
          transform transition-all duration-300
          ${isDeleteModalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}
        `}
      >
        <Delete
          size={66}
          className="text-white bg-red-500 p-3 rounded-full mb-2"
        />

        <h2 className="text-lg font-semibold text-gray-800">
          Confirm Deletion
        </h2>

        <p className="text-sm text-gray-600 mb-5">
          This action cannot be undone. Are you sure you want to delete this
          item?
        </p>

        <div className="flex flex-cols items-center w-full gap-2">
          <button
            className="bg-red-500 text-white px-4 py-2 w-[50%] rounded-md border border-red-600 hover:bg-white hover:text-red-600 transition cursor-pointer"
            onClick={onDelete}
          >
            Delete Item
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(false)}
            className="bg-white text-black px-4 py-2 rounded-md border w-[50%] border-black hover:border-red-600 hover:text-red-600 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
