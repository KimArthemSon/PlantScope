import { useParams } from "react-router-dom";

export default function Add_site_multicriteria_analysis() {
  const { id } = useParams();
  return <div>{id}</div>;
}
