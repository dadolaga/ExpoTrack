import { ProductEditor } from "@/components/products/ProductEditor";

export default async function ProductPage({ params }: {
  params: Promise<{
    productId: string;
  }>;
}) {
  const { productId } = await params;

  return <ProductEditor productId={productId} />;
}
