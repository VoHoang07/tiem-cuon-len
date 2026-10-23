"use client"

import * as React from "react"
import PushpinTearFooter from "@/components/ui/pushpin-tear-footer"

// Phiên bản Tiệm Cuộn Len: Tông màu be chủ đạo (#D8C3AD) phối giấy be nhạt (#FAF5EE), 100% tiếng Việt
export default function DemoTiemCuonLen() {
  return (
    <div style={{ width: "100%", backgroundColor: "#D8C3AD" }}>
      <PushpinTearFooter
        brand="Tiệm Cuộn Len."
        name="len thủ công handmade"
        logoHref="/"
        logo={<span style={{ fontSize: "1.35em", fontWeight: 700, letterSpacing: "-0.03em" }}>🧶 TCL.</span>}
        sheet="#D8C3AD"
        paper="#FAF5EE"
        sheetInk="#3D2B1F"
        paperInk="#4A3525"
        seed={23}
        email="lienhe@tiemcuonlen.vn"
        newsletter={{
          label: "Nhận thông báo mẫu len thủ công mới mỗi tuần",
          placeholder: "nhập email của bạn...",
        }}
        status={{
          label: "Đang nhận đặt đan móc mẫu len theo yêu cầu",
          href: "/",
        }}
        mark="MẺ LEN 0412"
        timeZone="Asia/Ho_Chi_Minh"
        timeLabel="VN"
        socials={[
          { icon: "ig", label: "Instagram", href: "https://instagram.com" },
          { icon: "chat", label: "Nhắn tin", href: "/help" },
        ]}
        columns={[
          {
            title: "cửa tiệm",
            links: [
              { label: "Móc len thủ công", href: "/" },
              { label: "Túi xách & Ví len", href: "/" },
              { label: "Thú bông & Quà tặng", href: "/" },
            ],
            cta: { label: "mua sắm.", href: "/" },
          },
          {
            title: "khách hàng",
            links: [
              { label: "Giỏ hàng của bạn", href: "/cart" },
              { label: "Sản phẩm yêu thích", href: "/favorites" },
              { label: "Tra cứu đơn hàng", href: "/orders" },
            ],
            cta: { label: "đặt mẫu.", href: "mailto:lienhe@tiemcuonlen.vn" },
          },
        ]}
        sideLinks={[
          { icon: "shield", label: "bảo mật", href: "/privacy" },
          { icon: "doc", label: "trợ giúp", href: "/help" },
        ]}
        chat={{ label: "tư vấn", href: "/help" }}
        copyright="© 2026 Tiệm Cuộn Len."
        credit="đan móc thủ công tại việt nam"
        handle={{ label: "@tiemcuonlen", href: "/" }}
      />
    </div>
  )
}
